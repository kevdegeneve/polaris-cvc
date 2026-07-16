import { AppData, Intervention } from "../domain/types";

function escapeHtml(value: string | undefined): string {
  return (value || "").replace(/[&<>"']/g, (char) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    };
    return map[char];
  });
}

export function buildReportHtml(data: AppData, intervention: Intervention): string {
  const customer = data.customers.find((item) => item.id === intervention.customerId);
  const site = data.sites.find((item) => item.id === intervention.siteId);
  const equipment = data.equipment.find((item) => item.id === intervention.equipmentId);
  const author = data.users.find((item) => item.id === intervention.authorId);
  const photos = data.media.filter((item) => item.interventionId === intervention.id && item.type === "photo");

  const section = (title: string, body: string) => `
    <section>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(body) || "Non renseigne"}</p>
    </section>
  `;

  return `
    <!doctype html>
    <html lang="fr">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(intervention.number)}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #17252b; margin: 32px; line-height: 1.45; }
          header { border-bottom: 4px solid #20c7b6; padding-bottom: 18px; margin-bottom: 24px; }
          h1 { margin: 0; font-size: 28px; }
          h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .06em; color: #0b5f68; margin-bottom: 6px; }
          p { margin-top: 0; white-space: pre-wrap; }
          .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 18px; }
          .box { border: 1px solid #cad8dc; border-radius: 8px; padding: 12px; }
          .status { display: inline-block; padding: 6px 10px; border-radius: 999px; background: #e8faf7; color: #07565e; font-weight: 700; }
          .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .photos img { width: 100%; border-radius: 8px; border: 1px solid #cad8dc; }
          footer { margin-top: 32px; font-size: 12px; color: #5c7077; }
          @media print { body { margin: 18mm; } button { display: none; } }
        </style>
      </head>
      <body>
        <button onclick="window.print()">Generer le PDF</button>
        <header>
          <h1>Rapport d'intervention CVC</h1>
          <p><strong>${escapeHtml(intervention.number)}</strong> - ${escapeHtml(intervention.title)}</p>
          <span class="status">${escapeHtml(intervention.resultStatus.replace("_", " "))}</span>
        </header>
        <div class="meta">
          <div class="box"><strong>Client</strong><br />${escapeHtml(customer?.name)}<br />${escapeHtml(site?.address)}</div>
          <div class="box"><strong>Technicien</strong><br />${escapeHtml(author?.displayName)}<br />${escapeHtml(author?.email)}</div>
          <div class="box"><strong>Site</strong><br />${escapeHtml(site?.name)}</div>
          <div class="box"><strong>Equipement</strong><br />${escapeHtml(equipment?.brand)} ${escapeHtml(equipment?.model)}<br />${escapeHtml(equipment?.serialNumber)}</div>
        </div>
        ${section("Demande client", intervention.customerRequest)}
        ${section("Symptome constate", intervention.observedSymptom)}
        ${section("Controles effectues", intervention.checksPerformed)}
        ${section("Mesures", intervention.measures)}
        ${section("Diagnostic", intervention.diagnosis)}
        ${section("Travaux realises", intervention.workDone)}
        ${section("Resultat final", intervention.finalResult)}
        ${section("Preconisations", intervention.recommendations)}
        ${
          photos.length
            ? `<h2>Photos</h2><div class="photos">${photos
                .map((photo) => `<img src="${photo.dataUrl}" alt="${escapeHtml(photo.name)}" />`)
                .join("")}</div>`
            : ""
        }
        <footer>${escapeHtml(data.company.reportFooter)}</footer>
      </body>
    </html>
  `;
}

export function openPrintableReport(data: AppData, intervention: Intervention): void {
  const report = window.open("", "_blank", "noopener,noreferrer");
  if (!report) return;
  report.document.write(buildReportHtml(data, intervention));
  report.document.close();
}
