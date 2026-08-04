# Pokémon Letterboxd

https://frozen-h2o.github.io/

A personal website to list played Pokemon fan games as well as my ratings and reviews of them.

## Adding a game

Each game has its own JSON (copied from example.json or template.json) and is listed in `data/games.json`.
Games with a `completion.main` Unix timestamp appear in Played and open review modals.
Games without `completion.main` timestamp appear in Backlog and open their game's `link` directly.
