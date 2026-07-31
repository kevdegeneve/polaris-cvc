import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import OpenAI from "openai";
import { createHash } from "node:crypto";
import { DIAGNOSTIC_MODEL, DIAGNOSTIC_PROMPT_VERSION, buildDiagnosticPrompt } from "./prompt.js";
import { buildArchiveTitle } from "./result.js";
import { isPreferredLanguage, removeUndefinedFields, validateDiagnosticAIResult, validateOpenAIDiagnosticPayload } from "./validation.js";
initializeApp();
const openAiApiKey = defineSecret("OPENAI_API_KEY");
const db = getFirestore();
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
const maxImageSize = 10 * 1024 * 1024;
const openAiTimeoutMs = 75_000;
const diagnosticResponseFormat = {
    type: "json_schema",
    json_schema: {
        name: "polaris_diagnostic_analysis",
        strict: true,
        schema: {
            type: "object",
            additionalProperties: false,
            required: [
                "detectedBrand",
                "detectedModel",
                "detectedSerialNumber",
                "detectedEquipmentType",
                "detectedErrorCode",
                "plateExtractedText",
                "faultImageExtractedText",
                "faultDescription",
                "probableCauses",
                "recommendedChecks",
                "expectedMeasurements",
                "safetyWarnings",
                "suggestedSolutions",
                "missingInformation",
                "recommendedAdditionalPhotos",
                "needsMoreInformation",
                "confidenceLevel",
                "analysisLanguage",
                "sourceReferences"
            ],
            properties: {
                detectedBrand: { type: ["string", "null"] },
                detectedModel: { type: ["string", "null"] },
                detectedSerialNumber: { type: ["string", "null"] },
                detectedEquipmentType: { type: ["string", "null"] },
                detectedErrorCode: { type: ["string", "null"] },
                plateExtractedText: { type: "array", items: { type: "string" } },
                faultImageExtractedText: { type: "array", items: { type: "string" } },
                faultDescription: { type: ["string", "null"] },
                probableCauses: { type: "array", items: { type: "string" } },
                recommendedChecks: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["title", "instruction", "reason", "expectedResult", "safetyLevel", "order"],
                        properties: {
                            title: { type: "string" },
                            instruction: { type: "string" },
                            reason: { type: "string" },
                            expectedResult: { type: "string" },
                            safetyLevel: { type: "string", enum: ["low", "medium", "high"] },
                            order: { type: "number" }
                        }
                    }
                },
                expectedMeasurements: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        required: ["measurement", "location", "expectedValue", "unit", "tolerance", "conditions"],
                        properties: {
                            measurement: { type: "string" },
                            location: { type: "string" },
                            expectedValue: { type: "string" },
                            unit: { type: ["string", "null"] },
                            tolerance: { type: ["string", "null"] },
                            conditions: { type: ["string", "null"] }
                        }
                    }
                },
                safetyWarnings: { type: "array", items: { type: "string" } },
                suggestedSolutions: { type: "array", items: { type: "string" } },
                missingInformation: { type: "array", items: { type: "string" } },
                recommendedAdditionalPhotos: { type: "array", items: { type: "string" } },
                needsMoreInformation: { type: "boolean" },
                confidenceLevel: { type: "number", minimum: 0, maximum: 1 },
                analysisLanguage: { type: "string", enum: ["fr", "en", "de", "it", "es"] },
                sourceReferences: {
                    type: "array",
                    items: {
                        type: "object",
                        additionalProperties: false,
                        required: [
                            "documentId",
                            "title",
                            "manufacturer",
                            "originalLanguage",
                            "displayedLanguage",
                            "sourceUrl",
                            "documentReference",
                            "documentVersion",
                            "pagesUsed",
                            "sectionsUsed",
                            "excerptsUsed",
                            "hash",
                            "verificationStatus"
                        ],
                        properties: {
                            documentId: { type: ["string", "null"] },
                            title: { type: "string" },
                            manufacturer: { type: ["string", "null"] },
                            originalLanguage: { type: ["string", "null"] },
                            displayedLanguage: { type: ["string", "null"] },
                            sourceUrl: { type: ["string", "null"] },
                            documentReference: { type: ["string", "null"] },
                            documentVersion: { type: ["string", "null"] },
                            pagesUsed: { type: "array", items: { type: "string" } },
                            sectionsUsed: { type: "array", items: { type: "string" } },
                            excerptsUsed: { type: "array", items: { type: "string" } },
                            hash: { type: ["string", "null"] },
                            verificationStatus: { type: ["string", "null"], enum: ["a_verifier", "verifie", "rejete", null] }
                        }
                    }
                }
            }
        }
    }
};
export const analyzeDiagnostic = onCall({
    region: "europe-west1",
    secrets: [openAiApiKey],
    timeoutSeconds: 120,
    memory: "1GiB"
}, async (request) => {
    if (!request.auth)
        throw new HttpsError("unauthenticated", "Authentification requise.");
    const diagnosticId = readDiagnosticId(request.data);
    const uid = request.auth.uid;
    const user = await readActiveUser(uid);
    await readActiveAuthorization(user);
    const diagnosticRef = db.collection("diagnostics").doc(diagnosticId);
    const photosQuery = db.collection("diagnosticPhotos").where("diagnosticId", "==", diagnosticId);
    await db.runTransaction(async (transaction) => {
        const diagnosticSnap = await transaction.get(diagnosticRef);
        if (!diagnosticSnap.exists)
            throw new HttpsError("not-found", "Diagnostic introuvable.");
        const diagnostic = { id: diagnosticSnap.id, ...diagnosticSnap.data() };
        assertDiagnosticAccess(diagnostic, user, uid);
        if (diagnostic.status === "archived")
            throw new HttpsError("failed-precondition", "Diagnostic deja archive.");
        if (diagnostic.status === "analyzing")
            throw new HttpsError("aborted", "Une analyse est deja en cours.");
        if ((diagnostic.analysisAttemptCount || 0) >= 2 && !isAdmin(user)) {
            throw new HttpsError("resource-exhausted", "Nombre maximal d'analyses atteint pour ce diagnostic.");
        }
        transaction.update(diagnosticRef, {
            status: "analyzing",
            analysisStartedAt: new Date().toISOString(),
            analysisRequestedBy: uid,
            analysisAttemptCount: (diagnostic.analysisAttemptCount || 0) + 1,
            updatedAt: new Date().toISOString()
        });
    });
    try {
        const diagnosticSnap = await diagnosticRef.get();
        const diagnostic = { id: diagnosticSnap.id, ...diagnosticSnap.data() };
        assertDiagnosticAccess(diagnostic, user, uid);
        const photos = (await photosQuery.get()).docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        const usablePhotos = selectUsablePhotos(photos, diagnosticId);
        console.info("diagnostic_storage_read_started", { diagnosticId, imageCount: usablePhotos.length });
        const loadedPhotos = await Promise.all(usablePhotos.map(loadPhoto));
        console.info("diagnostic_storage_read_completed", { diagnosticId, imageCount: loadedPhotos.length });
        const photoSignature = createHash("sha256")
            .update(loadedPhotos.map((photo) => `${photo.path}:${photo.hash}`).join("|"))
            .update(DIAGNOSTIC_PROMPT_VERSION)
            .digest("hex");
        if (diagnostic.analyzedPhotoSignature === photoSignature) {
            throw new HttpsError("already-exists", "Ces photos ont deja ete analysees avec cette version du prompt.");
        }
        const language = isPreferredLanguage(user.preferredLanguage) ? user.preferredLanguage : "fr";
        console.info("diagnostic_openai_started", { diagnosticId, imageCount: loadedPhotos.length, model: DIAGNOSTIC_MODEL });
        const result = await analyzeWithOpenAI(loadedPhotos, language);
        console.info("diagnostic_openai_completed", { diagnosticId, confidenceLevel: result.confidenceLevel, needsMoreInformation: result.needsMoreInformation });
        const finalResult = {
            ...normalizeInformationNeeds(result),
            analyzedAt: new Date().toISOString(),
            modelUsed: DIAGNOSTIC_MODEL,
            promptVersion: DIAGNOSTIC_PROMPT_VERSION,
            sourceReferences: result.sourceReferences || []
        };
        const validated = validateDiagnosticAIResult(finalResult);
        console.info("diagnostic_response_validated", { diagnosticId, confidenceLevel: validated.confidenceLevel });
        const technicalMemoryInsight = await safelyBuildTechnicalMemoryInsight(diagnostic, validated, language);
        const title = buildArchiveTitle(validated);
        await diagnosticRef.set(removeUndefinedFields({
            title,
            status: "awaiting_technician_input",
            detectedBrand: validated.detectedBrand || undefined,
            detectedModel: validated.detectedModel || undefined,
            detectedSerialNumber: validated.detectedSerialNumber || undefined,
            detectedEquipmentType: validated.detectedEquipmentType || undefined,
            detectedErrorCode: validated.detectedErrorCode || undefined,
            shortFaultDescription: validated.faultDescription || undefined,
            probableCauses: validated.probableCauses,
            recommendedChecks: validated.recommendedChecks,
            expectedMeasurements: validated.expectedMeasurements,
            proposedSolutions: validated.suggestedSolutions,
            safetyWarnings: validated.safetyWarnings,
            confidenceLevel: validated.confidenceLevel,
            sourceReferences: validated.sourceReferences,
            documentIds: validated.sourceReferences.map((source) => source.documentId).filter(Boolean),
            analysisResult: validated,
            technicalMemoryInsight,
            analysisSummary: validated.faultDescription || undefined,
            analysisCompletedAt: validated.analyzedAt,
            analyzedPhotoSignature: photoSignature,
            promptVersion: DIAGNOSTIC_PROMPT_VERSION,
            modelUsed: DIAGNOSTIC_MODEL,
            updatedAt: new Date().toISOString()
        }), { merge: true });
        await Promise.all(usablePhotos.map((photo) => db.collection("diagnosticPhotos").doc(photo.id).set({ analysisStatus: "analyzed", updatedAt: new Date().toISOString() }, { merge: true })));
        console.info("diagnostic_result_saved", { diagnosticId, needsMoreInformation: validated.needsMoreInformation });
        console.info("diagnostic_analysis_completed", {
            diagnosticId,
            uid: uid.slice(0, 8),
            model: DIAGNOSTIC_MODEL,
            imageCount: loadedPhotos.length
        });
        return {
            status: "completed",
            message: "Analyse terminee.",
            analysis: {
                result: validated,
                detectedBrand: validated.detectedBrand,
                detectedModel: validated.detectedModel,
                detectedErrorCode: validated.detectedErrorCode,
                shortFaultDescription: validated.faultDescription,
                sourceReferences: validated.sourceReferences,
                confidenceLevel: validated.confidenceLevel,
                technicalMemoryInsight
            }
        };
    }
    catch (error) {
        await diagnosticRef.set({
            status: "analysis_failed",
            analysisError: error instanceof HttpsError ? error.message : "Analyse impossible pour le moment.",
            updatedAt: new Date().toISOString()
        }, { merge: true });
        if (error instanceof HttpsError)
            throw error;
        console.error("diagnostic_analysis_failed", { diagnosticId, uid: uid.slice(0, 8), code: error instanceof Error ? error.message : "unknown" });
        console.error("diagnostic_failed", { diagnosticId, uid: uid.slice(0, 8), code: error instanceof Error ? error.message : "unknown" });
        throw new HttpsError("internal", "Analyse impossible pour le moment.");
    }
});
function readDiagnosticId(data) {
    if (typeof data !== "object" || data === null || !("diagnosticId" in data) || typeof data.diagnosticId !== "string") {
        throw new HttpsError("invalid-argument", "diagnosticId requis.");
    }
    if (data.diagnosticId.length > 120)
        throw new HttpsError("invalid-argument", "diagnosticId invalide.");
    return data.diagnosticId;
}
async function safelyBuildTechnicalMemoryInsight(diagnostic, result, language) {
    try {
        return await buildTechnicalMemoryInsight(diagnostic, result, language);
    }
    catch (error) {
        console.warn("technical_memory_unavailable", {
            diagnosticId: diagnostic.id,
            companyId: diagnostic.companyId,
            error: error instanceof Error ? error.message : "unknown"
        });
        return emptyTechnicalMemoryInsight();
    }
}
async function buildTechnicalMemoryInsight(diagnostic, result, language) {
    const snapshot = await db.collection("technicalMemoryFeedbacks").where("companyId", "==", diagnostic.companyId).limit(500).get();
    const feedbacks = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    const similar = feedbacks.filter((feedback) => isSimilarMemoryCase(feedback, diagnostic, result));
    const repairedCount = similar.filter((feedback) => feedback.repairResult === "repare").length;
    const partiallyRepairedCount = similar.filter((feedback) => feedback.repairResult === "repare_partiellement").length;
    const unrepairedCount = similar.filter((feedback) => feedback.repairResult === "non_repare").length;
    const durations = similar.map((feedback) => feedback.timeSpentMinutes).filter((value) => Number.isFinite(value) && value > 0);
    const causeStats = countBy(similar, "actualCause", (value) => causeLabel(value, language), "cause");
    const actionStats = countActions(similar, language);
    return {
        totalKnownCases: similar.length,
        repairedCount,
        partiallyRepairedCount,
        unrepairedCount,
        successRate: similar.length ? Math.round(((repairedCount + partiallyRepairedCount) / similar.length) * 100) : 0,
        averageRepairTimeMinutes: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null,
        mostFrequentCause: causeStats[0] || null,
        causeStats,
        actionStats
    };
}
function emptyTechnicalMemoryInsight() {
    return {
        totalKnownCases: 0,
        repairedCount: 0,
        partiallyRepairedCount: 0,
        unrepairedCount: 0,
        successRate: 0,
        averageRepairTimeMinutes: null,
        mostFrequentCause: null,
        causeStats: [],
        actionStats: []
    };
}
function isSimilarMemoryCase(feedback, diagnostic, result) {
    if (feedback.diagnosticId === diagnostic.id)
        return false;
    const score = [
        sameNormalized(feedback.detectedBrand, result.detectedBrand),
        sameNormalized(feedback.detectedModel, result.detectedModel),
        sameNormalized(feedback.detectedEquipmentType, result.detectedEquipmentType),
        sameNormalized(feedback.detectedErrorCode, result.detectedErrorCode),
        intersects(feedback.aiProbableCauses || [], result.probableCauses)
    ].filter(Boolean).length;
    return score >= 2 || Boolean(result.detectedErrorCode && sameNormalized(feedback.detectedErrorCode, result.detectedErrorCode));
}
function sameNormalized(left, right) {
    return Boolean(left && right && normalize(left) === normalize(right));
}
function intersects(left, right) {
    const normalizedRight = new Set(right.map(normalize).filter(Boolean));
    return left.map(normalize).some((item) => normalizedRight.has(item));
}
function normalize(value) {
    return value.trim().toLowerCase();
}
function countBy(feedbacks, field, labeler, keyName) {
    const counts = new Map();
    for (const feedback of feedbacks)
        counts.set(String(feedback[field]), (counts.get(String(feedback[field])) || 0) + 1);
    return Array.from(counts.entries())
        .map(([value, count]) => ({ [keyName]: value, label: labeler(value), count }))
        .sort(sortByCountAndLabel);
}
function countActions(feedbacks, language) {
    const counts = new Map();
    for (const feedback of feedbacks) {
        for (const action of feedback.actions || [])
            counts.set(action, (counts.get(action) || 0) + 1);
    }
    return Array.from(counts.entries())
        .map(([action, count]) => ({ action, label: actionLabel(action, language), count }))
        .sort(sortByCountAndLabel);
}
function sortByCountAndLabel(left, right) {
    return right.count - left.count || left.label.localeCompare(right.label);
}
function causeLabel(value, language) {
    const labels = causeLabels[language || "fr"] || causeLabels.fr;
    return labels[value] || value;
}
function actionLabel(value, language) {
    const labels = actionLabels[language || "fr"] || actionLabels.fr;
    return labels[value] || value;
}
const causeLabels = {
    fr: {
        sonde_defectueuse: "Sonde defectueuse",
        carte_electronique_hs: "Carte electronique HS",
        ventilateur_bloque: "Ventilateur bloque",
        manque_de_fluide: "Manque de fluide",
        fuite_detectee: "Fuite detectee",
        connecteur_desserre: "Connecteur desserre",
        mauvais_cablage: "Mauvais cablage",
        parametrage: "Parametrage",
        autre: "Autre"
    },
    en: {
        sonde_defectueuse: "Faulty sensor",
        carte_electronique_hs: "Failed electronic board",
        ventilateur_bloque: "Blocked fan",
        manque_de_fluide: "Low refrigerant charge",
        fuite_detectee: "Leak detected",
        connecteur_desserre: "Loose connector",
        mauvais_cablage: "Incorrect wiring",
        parametrage: "Parameter setting",
        autre: "Other"
    },
    de: {
        sonde_defectueuse: "Defekter Sensor",
        carte_electronique_hs: "Defekte Elektronikplatine",
        ventilateur_bloque: "Blockierter Ventilator",
        manque_de_fluide: "Kaeltemittelmangel",
        fuite_detectee: "Leck erkannt",
        connecteur_desserre: "Lockerer Stecker",
        mauvais_cablage: "Falsche Verkabelung",
        parametrage: "Parametrierung",
        autre: "Andere"
    },
    it: {
        sonde_defectueuse: "Sonda difettosa",
        carte_electronique_hs: "Scheda elettronica guasta",
        ventilateur_bloque: "Ventilatore bloccato",
        manque_de_fluide: "Mancanza di fluido",
        fuite_detectee: "Perdita rilevata",
        connecteur_desserre: "Connettore allentato",
        mauvais_cablage: "Cablaggio errato",
        parametrage: "Parametrizzazione",
        autre: "Altro"
    },
    es: {
        sonde_defectueuse: "Sonda defectuosa",
        carte_electronique_hs: "Placa electronica averiada",
        ventilateur_bloque: "Ventilador bloqueado",
        manque_de_fluide: "Falta de fluido",
        fuite_detectee: "Fuga detectada",
        connecteur_desserre: "Conector flojo",
        mauvais_cablage: "Cableado incorrecto",
        parametrage: "Parametrizacion",
        autre: "Otro"
    }
};
const actionLabels = {
    fr: {
        remplacement_sonde: "Remplacement sonde",
        remplacement_carte: "Remplacement carte",
        ajout_fluide: "Ajout de fluide",
        recherche_fuite: "Recherche de fuite",
        remplacement_ventilateur: "Remplacement ventilateur",
        nettoyage: "Nettoyage",
        resserrage_connecteur: "Resserrage connecteur",
        reparametrage: "Reparametrage",
        autre: "Autre"
    },
    en: {
        remplacement_sonde: "Sensor replacement",
        remplacement_carte: "Board replacement",
        ajout_fluide: "Refrigerant top-up",
        recherche_fuite: "Leak search",
        remplacement_ventilateur: "Fan replacement",
        nettoyage: "Cleaning",
        resserrage_connecteur: "Connector tightening",
        reparametrage: "Reconfiguration",
        autre: "Other"
    },
    de: {
        remplacement_sonde: "Sensor ersetzt",
        remplacement_carte: "Platine ersetzt",
        ajout_fluide: "Kaeltemittel nachgefuellt",
        recherche_fuite: "Lecksuche",
        remplacement_ventilateur: "Ventilator ersetzt",
        nettoyage: "Reinigung",
        resserrage_connecteur: "Stecker nachgezogen",
        reparametrage: "Neu parametriert",
        autre: "Andere"
    },
    it: {
        remplacement_sonde: "Sostituzione sonda",
        remplacement_carte: "Sostituzione scheda",
        ajout_fluide: "Aggiunta fluido",
        recherche_fuite: "Ricerca perdita",
        remplacement_ventilateur: "Sostituzione ventilatore",
        nettoyage: "Pulizia",
        resserrage_connecteur: "Serraggio connettore",
        reparametrage: "Riconfigurazione",
        autre: "Altro"
    },
    es: {
        remplacement_sonde: "Sustitucion de sonda",
        remplacement_carte: "Sustitucion de placa",
        ajout_fluide: "Carga de fluido",
        recherche_fuite: "Busqueda de fuga",
        remplacement_ventilateur: "Sustitucion de ventilador",
        nettoyage: "Limpieza",
        resserrage_connecteur: "Apriete de conector",
        reparametrage: "Reparametrizacion",
        autre: "Otro"
    }
};
async function readActiveUser(uid) {
    const snap = await db.collection("users").doc(uid).get();
    if (!snap.exists)
        throw new HttpsError("permission-denied", "Profil utilisateur introuvable.");
    const user = { uid, ...snap.data() };
    if (user.isActive !== true)
        throw new HttpsError("permission-denied", "Utilisateur desactive.");
    return user;
}
async function readActiveAuthorization(user) {
    if (typeof user.emailNormalized !== "string" || !user.emailNormalized) {
        throw new HttpsError("permission-denied", "Email utilisateur non verifie.");
    }
    const snap = await db.collection("authorizedUsers").doc(user.emailNormalized).get();
    if (!snap.exists || snap.get("isActive") !== true || snap.get("companyId") !== user.companyId || snap.get("role") !== user.role) {
        throw new HttpsError("permission-denied", "Utilisateur non autorise.");
    }
}
function assertDiagnosticAccess(diagnostic, user, uid) {
    if (diagnostic.companyId !== user.companyId)
        throw new HttpsError("permission-denied", "Diagnostic hors entreprise.");
    if (diagnostic.technicianId !== uid && !isAdmin(user))
        throw new HttpsError("permission-denied", "Diagnostic non accessible.");
}
function isAdmin(user) {
    return user.role === "admin" || user.role === "administrateur";
}
function selectUsablePhotos(photos, diagnosticId) {
    const usablePhotos = photos.filter((photo) => {
        return (photo.storagePath.startsWith(`diagnostics/${diagnosticId}/photos/`)
            && allowedMimeTypes.includes(photo.mimeType)
            && photo.size <= maxImageSize);
    });
    if (usablePhotos.length === 0)
        throw new HttpsError("failed-precondition", "Au moins une photo exploitable est requise.");
    return usablePhotos;
}
async function loadPhoto(photo) {
    const file = getStorage().bucket().file(photo.storagePath);
    const [exists] = await file.exists();
    if (!exists)
        throw new HttpsError("not-found", "Fichier image introuvable.");
    const [metadata] = await file.getMetadata();
    if (!allowedMimeTypes.includes(String(metadata.contentType)))
        throw new HttpsError("invalid-argument", "Type MIME Storage invalide.");
    const [buffer] = await file.download();
    if (buffer.byteLength > maxImageSize)
        throw new HttpsError("invalid-argument", "Image trop volumineuse.");
    return {
        path: photo.storagePath,
        mimeType: String(metadata.contentType),
        base64: buffer.toString("base64"),
        hash: createHash("sha256").update(buffer).digest("hex")
    };
}
async function analyzeWithOpenAI(photos, language) {
    const apiKey = openAiApiKey.value();
    if (!apiKey)
        throw new HttpsError("failed-precondition", "Secret OPENAI_API_KEY absent.");
    const client = new OpenAI({ apiKey });
    const response = await withTimeout(client.chat.completions.create({
        model: DIAGNOSTIC_MODEL,
        response_format: diagnosticResponseFormat,
        messages: [
            { role: "system", content: buildDiagnosticPrompt(language || "fr") },
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: "Analyze all available HVAC diagnostic images. If information is insufficient, return quickly with needsMoreInformation true, missingInformation and recommendedAdditionalPhotos. Do not invent unreadable references or error codes. Return concise strict JSON only."
                    },
                    ...photos.map((photo) => ({
                        type: "image_url",
                        image_url: { url: `data:${photo.mimeType};base64,${photo.base64}` }
                    }))
                ]
            }
        ]
    }), openAiTimeoutMs, new HttpsError("deadline-exceeded", "OpenAI trop lent. Relancez le diagnostic ou ajoutez une photo plus lisible."));
    const content = response.choices[0]?.message?.content;
    if (!content)
        throw new Error("empty_openai_response");
    return validateOpenAIDiagnosticPayload(JSON.parse(content));
}
function normalizeInformationNeeds(result) {
    if (result.needsMoreInformation || result.confidenceLevel > 0.45)
        return result;
    return {
        ...result,
        needsMoreInformation: true,
        recommendedAdditionalPhotos: result.recommendedAdditionalPhotos.length > 0
            ? result.recommendedAdditionalPhotos
            : ["Plaque signaletique complete", "Ecran affichant le code erreur", "Vue generale de l'installation"]
    };
}
function withTimeout(promise, timeoutMs, error) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(error), timeoutMs);
        promise.then((value) => {
            clearTimeout(timeout);
            resolve(value);
        }, (reason) => {
            clearTimeout(timeout);
            reject(reason);
        });
    });
}
