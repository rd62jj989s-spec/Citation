"""Bettet die erfundene Beispielquelle als Base64 in zitationspruefer.html ein.

Aufruf nach make_samples.py:  python3 embed_demo.py
"""

import base64
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
HTML = os.path.join(HERE, "..", "zitationspruefer.html")
PDF = os.path.join(HERE, "samples", "Muster_2021_Organisationskommunikation.pdf")


def main():
    with open(PDF, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    with open(HTML, encoding="utf-8") as f:
        html = f.read()
    new, n = re.subn(
        r"/\*DEMO_PDF_BEGIN\*/'[^']*'/\*DEMO_PDF_END\*/",
        "/*DEMO_PDF_BEGIN*/'" + b64 + "'/*DEMO_PDF_END*/",
        html,
    )
    if n != 1:
        raise SystemExit("Platzhalter für die Beispiel-PDF nicht gefunden")
    with open(HTML, "w", encoding="utf-8") as f:
        f.write(new)
    print(f"Beispiel-PDF eingebettet ({len(b64)} Zeichen)")


if __name__ == "__main__":
    main()
