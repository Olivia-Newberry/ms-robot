# Fun commands

| Command | What it does | Source |
|---|---|---|
| `/animal kind:` cat, dog or fox | Picture, plus a fact for cats and dogs | TheCatAPI + catfact.ninja, dog.ceo + dogapi.dog, randomfox.ca |
| `/cat` | Same as `/animal kind:cat` | |
| `/hug`, `/wink`, `/facepalm`, `/headpat` | Anime gif, optionally aimed at someone with a message | nekos.best |
| `/joke` | A dad joke | icanhazdadjoke |
| `/define term:` | Urban Dictionary definition | Urban Dictionary |
| `/gif search:` | A gif matching the search | Giphy (needs `GIPHY_API_KEY`) |
| `/time` | The current time and an xkcd timezone map | |
| `/movealong`, `/rejoice` | Video links | |

With `/hug` and the others, the chosen user is pinged, and only them: mentions typed
into the message show as text but notify nobody.

All the sources are free and need no key, apart from Giphy. If one stops working, `npm
run test:live` shows which (see [../development.md](../development.md)).
