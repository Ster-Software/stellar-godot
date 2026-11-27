# Godot voor Stellar Studio

Godot-projecten starten, scènes uitvoeren, exporteren en openen in de Godot-editor, rechtstreeks vanuit Stellar Studio.

## Installeren

Open **Extensies** in Stellar Studio, zoek **Godot** van **Ster-Software** en kies **Installeren**.

Voor handmatige installatie: pak het bronarchief van een release uit in `~/.stellar/extensions/@ster-software/godot/`, met `manifest.json` direct in die map.

## Gebruik

Open een map met `project.godot`. Het Godot-icoon verschijnt in de activiteitenbalk. De zijbalk toont het project, scènes, autoloads, exportinstellingen en plug-ins. Start het spel of één scène, herstart of stop de spelterminal, exporteer met een preset of open de Godot-editor.

Klik met rechts op een `.tscn`-bestand om die scène te starten. In het commandopalet staan **Godot: spel starten**, **Godot: openen in de editor** en **Godot: deze scène starten**.

Bij **Nieuw project** staat het sjabloon **Godot-spel**. Onder **Instellingen → Thema** staat een Godot-kleurthema bij de extensiethema's.

## Vereisten en toegang

Stellar Studio 1.8.20 of nieuwer en Godot 4. De extensie zoekt Godot op je PATH en op gangbare installatielocaties. Voor exporteren zijn Godots exporttemplates nodig.

De extensie gebruikt bestanden en processen om projectgegevens te lezen en Godot te starten. Toegangsrechten zijn informatief; extensies draaien met de rechten van Stellar.

Broncode: https://github.com/Ster-Software/stellar-godot
