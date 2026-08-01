# Pokémon Letterboxd

https://frozen-h2o.github.io/

A personal website to list played Pokemon fan games as well as my ratings and reviews of them.

## Adding a game

Each game uses the same JSON format whether it is played or in the backlog. Specify its path in one of the following manifests:

- `data/games.json` - games that have been played and open review modals when clicked.
- `data/backlog.json` - unplayed games that open their `link` directly.
