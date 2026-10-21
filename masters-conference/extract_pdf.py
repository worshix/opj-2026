import pdfplumber, os
folder = r"C:\Users\worsh\business\opj\opj-2026\masters-conference"
for fname in ["conference template.pdf", "Takunda_Revised_Journal_Paper_PLC_MultiSensor_Harvard.pdf", "Takunda Review Paper.pdf"]:
    path = os.path.join(folder, fname)
    out = os.path.join(folder, fname.replace(".pdf", ".txt"))
    text = ""
    with pdfplumber.open(path) as pdf:
        for i, page in enumerate(pdf.pages):
            p = page.extract_text()
            if p:
                text += f"\n--- PAGE {i+1} ---\n{p}"
    with open(out, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"Extracted: {out}")
