# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - heading "🎬 TasteMap" [level=1] [ref=e4]
    - paragraph [ref=e5]: Visualizing Your Film DNA
    - generic [ref=e7]: 0 ratings saved
  - generic [ref=e8]:
    - heading "Rate a Movie" [level=2] [ref=e9]
    - generic [ref=e10]:
      - generic [ref=e11]: "Search movies:"
      - combobox "Search for movies by title or year" [active] [ref=e12]: Inception
  - generic [ref=e13]:
    - heading "Your Taste Profile" [level=2] [ref=e14]
    - generic "Radar chart showing your taste profile" [ref=e16]
    - paragraph [ref=e18]: Rate some movies to build your taste profile!
  - generic [ref=e20]:
    - heading "Recommended for You" [level=2] [ref=e21]
    - paragraph [ref=e23]: Your recommendations will appear here after you rate a few movies.
  - generic [ref=e24]:
    - heading "🔍 Explore Your Taste" [level=2] [ref=e25]
    - generic [ref=e27]:
      - heading "Your Taste Clusters" [level=3] [ref=e28]
      - paragraph [ref=e30]: Rate movies to see your taste clusters
    - paragraph [ref=e33]: Timeline will appear after rating movies
  - generic [ref=e34]:
    - generic [ref=e35]:
      - heading "📥 Import IMDB Ratings" [level=3] [ref=e36]
      - paragraph [ref=e37]:
        - text: Export your ratings from
        - link "IMDB → Your Ratings & Reviews" [ref=e38] [cursor=pointer]:
          - /url: https://www.imdb.com/list/ratings
        - text: and upload the JSON file here.
      - button "📂 Choose IMDB JSON File" [ref=e40] [cursor=pointer]
    - generic [ref=e42]:
      - button "💾 Export Ratings" [ref=e43] [cursor=pointer]
      - button "🗑️ Clear All Data" [ref=e44] [cursor=pointer]
```