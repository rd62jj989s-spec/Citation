# Zitationsprüfer

Ein Programm, das die Zitate einer Masterarbeit gegen die Quell-PDFs prüft. Es läuft als private Seite direkt in Claude:

https://claude.ai/artifact/RNszysTHLnAFrD9NY2Th1L

Alle Dateien werden nur im Browser verarbeitet. Nichts wird hochgeladen oder an Claude gesendet.

## Was das Programm prüft

Wörtliche Zitate werden automatisch in der PDF gesucht. Für jedes Zitat zeigt das Programm:

1. ob der Wortlaut in der Quelle steht und wo er abweicht,
2. auf welcher Buchseite es steht und ob die Seitenangabe stimmt,
3. ein Bild der Buchseite, auf dem die gefundene Stelle gelb markiert ist.

Für sinngemäße Belege wird die angegebene Buchseite abgebildet, damit du selbst prüfen kannst, ob die Aussage dort belegt ist. Sätze mit gemeinsamen Begriffen sind als Orientierung blau umrandet.

Zusätzlich meldet das Programm:

1. wörtliche Zitate ohne Seitenangabe oder mit unvollständiger Angabe bei einem Seitenwechsel,
2. Auslassungen in einem Zitat, die nicht mit […] gekennzeichnet sind,
3. zitierte Werke, die im Literaturverzeichnis fehlen, und Einträge, die nie zitiert werden,
4. einige formale APA-7-Punkte, zum Beispiel ein fehlendes Komma zwischen Autor und Jahr oder „f.“ und „ff.“ statt genauer Seitenbereiche.

## So benutzt du es

1. Masterarbeit als Word-Datei (.docx) oder PDF auswählen. Word ist genauer, weil Blockzitate an der Einrückung erkannt werden.
2. Die Quell-PDFs auswählen oder in das Feld ziehen. Sie können im Browser gespeichert werden, damit du sie beim nächsten Mal nicht erneut auswählen musst.
3. Unter „Zuordnung“ prüfen, ob jedes zitierte Werk die richtige PDF hat. Eindeutige Fälle ordnet das Programm selbst zu, zum Beispiel über den Dateinamen „Muster_2021_Titel.pdf“.
4. Unter „Ergebnis“ die Befunde durchgehen. Mit „Probleme“ werden nur die Fälle gezeigt, die Aufmerksamkeit brauchen.

## Aktualisieren

Es gibt zwei Knöpfe „Aktualisieren“:

1. Oben im Ergebnis: Hier wählst du eine neue Fassung deiner Arbeit aus, zum Beispiel nachdem du Zitate korrigiert hast. Quellen und Zuordnungen bleiben erhalten. Danach steht dort, wie viele Probleme es vorher gab und wie viele jetzt noch.
2. Auf jeder Karte, bei der ein Zitat nicht gefunden wurde, keine PDF zugeordnet ist oder die angegebene Seite in der PDF fehlt: Hier wählst du die richtige PDF für genau dieses Werk aus. Sie wird geladen, dem Werk zugeordnet, und alle Belege dieses Werks werden neu geprüft.

## Seitenzahlen

Seitenangaben werden als gedruckte Buchseiten gelesen, nicht als PDF-Seiten. Das Programm erkennt die Buchseiten auf drei Wegen, in dieser Reihenfolge:

1. aus der Seitenbeschriftung, die viele Verlags-PDFs mitbringen,
2. aus den gedruckten Seitenzahlen oben oder unten auf den Seiten,
3. aus dem Seitenbereich im Literaturverzeichnis, zum Beispiel „41–44“ bei Zeitschriftenartikeln.

Wenn die Zählung nicht stimmt, kannst du sie unter „Quellen“ festlegen, zum Beispiel „PDF-Seite 15 ist S. 1“.

## Grenzen

1. Eingescannte PDFs ohne Textebene können nicht durchsucht werden. Das Programm weist darauf hin.
2. Sinngemäße Belege werden nicht automatisch bewertet. Das letzte Urteil liegt bei dir.
3. Erkannt werden Belege im APA-7-Format, zum Beispiel (Muster, 2021, S. 12) oder Muster (2021, S. 12).

## Entwicklung und Tests

Die Seite ist eine einzelne Datei: `zitationspruefer.html`. Die PDF-Bibliothek pdf.js und JSZip werden von cdnjs geladen.

Im Ordner `tests` liegen erfundene Beispieldateien und ein automatischer Browsertest:

```
cd tests
npm install
pip install reportlab python-docx
python3 make_samples.py    # Beispielquellen und Beispielarbeit (auch korrigierte Fassung) erzeugen
python3 embed_demo.py      # Beispiel-PDF in die Seite einbetten
node e2e.mjs               # Test in Chromium, Bilder landen in tests/out
```
