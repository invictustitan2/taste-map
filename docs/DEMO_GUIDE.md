# TasteMap Demo Guide

## 🚀 Quick Start

1. **Open the app**: Navigate to `http://localhost:8000` in your browser
2. **Search for a movie**: Click the search box and type (e.g., "mad", "2014", "grand")
3. **Navigate results**: Use arrow keys ↑↓ or mouse hover
4. **Select movie**: Press Enter or click on a movie
5. **View details**: See movie thumbnail, year, and full attribute breakdown
6. **Rate it**: Click a star rating (1-5)
7. **Watch magic happen**: Profile updates + recommendations appear!

## 🎮 Feature Demonstrations

### Demo 1: Search & Rate Flow
```
1. Type "blade" → See "Blade Runner 2049"
2. Press Enter → Movie details expand
3. Review attributes table (Dark: 85%, Artistic: 95%)
4. Click ⭐ 5 → "✓ Added Blade Runner 2049! (5 stars)"
5. Auto-scroll to recommendations
6. See profile update with high Dark/Artistic scores
```

### Demo 2: Build Your Profile
```
Rate these to see diverse profile:
- Mad Max: Fury Road (⭐ 5) → High Action
- The Shawshank Redemption (⭐ 5) → High Drama/Uplifting
- Superbad (⭐ 4) → High Comedy
- Blade Runner 2049 (⭐ 5) → High Dark/Artistic

Your profile will show balanced preferences!
```

### Demo 3: Keyboard Power User
```
1. Click search box
2. Type "the"
3. Press ↓ three times
4. Press Enter
5. Press Tab to rating buttons
6. Press Space to rate
7. Press Escape to dismiss (if needed)
```

### Demo 4: Recommendations Engine
```
After rating 3+ movies:
1. Scroll to recommendations
2. See "% match" badges
3. Click "Rate This Movie" on recommendation
4. Seamlessly rate and loop back
```

## 🧪 Test Scenarios

### Accessibility Test
- Use only keyboard (no mouse)
- Enable screen reader
- Tab through all elements
- Verify all actions possible via keyboard
- Check focus indicators visible

### Edge Cases Test
1. Search "xyz" → "No movies found"
2. Rate all 10 movies → "You've rated all available movies!"
3. Click Clear All Ratings → Confirm dialog → Profile resets
4. Export Data → JSON file downloads

### Mobile Responsive Test
1. Resize browser to 375px width
2. Verify search dropdown works
3. Check star buttons stack vertically
4. Confirm touch interactions work

## 📊 Expected Behavior

### Taste Profile Updates
After rating movies, you should see:
- **Progress bars** showing 0-100% for each attribute
- **Top preferences** listing dominant attributes
- **Statistics** showing total ratings and average score

### Recommendations Logic
- Uses **cosine similarity** algorithm
- Excludes already-rated movies
- Shows top 5 matches
- Sorts by similarity (highest first)

### Visual Feedback
- ✅ Success (green): Successful ratings, exports
- ⚠️ Warning (orange): Select movie first
- ❌ Error (red): Invalid operations, failures

## 🐛 Troubleshooting

### "No movies appearing in search"
- Check browser console for errors
- Verify `filmAttributes.js` loaded correctly
- Check that SAMPLE_MOVIES has data

### "Ratings not persisting"
- Check localStorage in DevTools (Application tab)
- Look for key: `tastemap-user-data`
- Verify browser allows localStorage

### "Dropdown not closing"
- Click outside dropdown area
- Press Escape key
- Refresh page if stuck

### "Console errors"
- Open DevTools (F12)
- Check Console tab for red errors
- Verify all JS files loaded (Network tab)

## 💡 Pro Tips

1. **Fast rating**: Type → Enter → Tab → 1-5 → Repeat
2. **See raw data**: Check localStorage in DevTools
3. **Debug mode**: Set `DEBUG_MODE = true` in dataStore.js
4. **Export often**: Download your data as backup
5. **Clear to restart**: Use Clear All Ratings for fresh start

## 🎯 Achievement Goals

- [ ] Rate your first movie
- [ ] Build a profile (rate 3+ movies)
- [ ] See your dominant preferences
- [ ] Get personalized recommendations
- [ ] Rate all 10 sample movies
- [ ] Export your data
- [ ] Use only keyboard navigation
- [ ] Test on mobile device

## 📱 Browser Compatibility

✅ Chrome/Edge (recommended)
✅ Firefox
✅ Safari
✅ Mobile browsers

**Requirements:**
- ES6 modules support
- localStorage enabled
- JavaScript enabled

---

## 🎬 Ready to Start?

Open **http://localhost:8000** and start rating movies to discover your film DNA! 🧬
