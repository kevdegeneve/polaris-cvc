export function buildArchiveTitle(result) {
    const brand = result.detectedBrand || "Equipement non identifie";
    if (result.detectedErrorCode)
        return `${brand} - ${result.detectedErrorCode}`;
    if (result.faultDescription)
        return `${brand} - ${result.faultDescription.slice(0, 80)}`;
    return "Diagnostic non identifie";
}
