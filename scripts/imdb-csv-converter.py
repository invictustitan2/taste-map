#!/usr/bin/env python3
"""
IMDB CSV to JSON Converter for TasteMap

Processes IMDB ratings and watchlist CSV exports into a single JSON file.

Usage:
    python convert-imdb-csv-to-json.py

Input files (expected in same directory):
    - df7fd8ec373b4c9ab88ef1a738569519.csv (ratings)
    - 808440a1a6fb4e03ac871d004ecbdbcf.csv (watchlist)

Output:
    - ratings.json (combined, deduplicated movies only)
"""

import pandas as pd
import json
from pathlib import Path

def convert_imdb_to_json():
    # File paths
    ratings_file = "df7fd8ec373b4c9ab88ef1a738569519.csv"
    watchlist_file = "808440a1a6fb4e03ac871d004ecbdbcf.csv"
    output_file = "ratings.json"
    
    print("🎬 TasteMap IMDB Converter")
    print("=" * 50)
    
    # Read ratings CSV
    print(f"\n📊 Reading {ratings_file}...")
    try:
        ratings_df = pd.read_csv(ratings_file)
        print(f"   Found {len(ratings_df)} rated items")
    except FileNotFoundError:
        print(f"   ❌ File not found: {ratings_file}")
        return
    
    # Read watchlist CSV
    print(f"\n📊 Reading {watchlist_file}...")
    try:
        watchlist_df = pd.read_csv(watchlist_file)
        print(f"   Found {len(watchlist_df)} watchlist items")
    except FileNotFoundError:
        print(f"   ❌ File not found: {watchlist_file}")
        return
    
    # Normalize column names (watchlist might have different order)
    # Keep only relevant columns that exist in both
    common_cols = [
        'Const', 'Title', 'Original Title', 'Title Type', 
        'IMDb Rating', 'Runtime (mins)', 'Year', 'Genres', 
        'Num Votes', 'Release Date', 'Directors',
        'Your Rating', 'Date Rated'
    ]
    
    # Prepare ratings dataframe
    ratings_clean = ratings_df[common_cols].copy()
    
    # Prepare watchlist dataframe (may have nulls in Your Rating)
    watchlist_cols = [c for c in common_cols if c in watchlist_df.columns]
    watchlist_clean = watchlist_df[watchlist_cols].copy()
    
    # Merge: ratings take precedence for duplicates
    print("\n🔄 Merging ratings and watchlist...")
    
    # Concatenate and drop duplicates (keeping first = ratings)
    combined_df = pd.concat([ratings_clean, watchlist_clean], ignore_index=True)
    combined_df = combined_df.drop_duplicates(subset=['Const'], keep='first')
    
    # Filter to movies only
    print("\n🎥 Filtering to movies only...")
    movies_df = combined_df[combined_df['Title Type'] == 'movie'].copy()
    print(f"   {len(movies_df)} movies (filtered out {len(combined_df) - len(movies_df)} non-movies)")
    
    # Convert to JSON-friendly format
    print("\n🔧 Converting to JSON format...")
    
    # Replace NaN with None for JSON compatibility
    movies_df = movies_df.where(pd.notnull(movies_df), None)
    
    # Convert numeric columns to proper types
    numeric_cols = {
        'Your Rating': 'Int64',  # Nullable integer
        'IMDb Rating': 'float',
        'Runtime (mins)': 'Int64',
        'Year': 'Int64',
        'Num Votes': 'Int64'
    }
    
    for col, dtype in numeric_cols.items():
        if col in movies_df.columns:
            try:
                if dtype == 'Int64':
                    movies_df[col] = pd.to_numeric(movies_df[col], errors='coerce').astype('Int64')
                else:
                    movies_df[col] = pd.to_numeric(movies_df[col], errors='coerce')
            except Exception as e:
                print(f"   ⚠️  Warning: Could not convert {col}: {e}")
    
    # Convert to list of dictionaries
    movies_list = movies_df.to_dict('records')
    
    # Clean up None values and convert Int64 to regular int for JSON
    cleaned_movies = []
    for movie in movies_list:
        cleaned_movie = {}
        for key, value in movie.items():
            # Handle pandas Int64/Float types
            if pd.isna(value):
                cleaned_movie[key] = None
            elif isinstance(value, (pd.Int64Dtype, int)):
                cleaned_movie[key] = int(value) if value is not None else None
            else:
                cleaned_movie[key] = value
        cleaned_movies.append(cleaned_movie)
    
    # Write to JSON
    print(f"\n💾 Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(cleaned_movies, f, indent=2, ensure_ascii=False)
    
    # Summary statistics
    rated_count = sum(1 for m in cleaned_movies if m.get('Your Rating') is not None)
    unwatched_count = len(cleaned_movies) - rated_count
    
    print("\n✅ Conversion complete!")
    print("=" * 50)
    print(f"📈 Summary:")
    print(f"   Total movies: {len(cleaned_movies)}")
    print(f"   Rated movies: {rated_count}")
    print(f"   Watchlist (unrated): {unwatched_count}")
    
    if rated_count > 0:
        ratings = [m['Your Rating'] for m in cleaned_movies if m.get('Your Rating') is not None]
        avg_rating = sum(ratings) / len(ratings)
        print(f"   Average rating: {avg_rating:.1f}/10")
        
        # Genre distribution for rated movies
        all_genres = []
        for m in cleaned_movies:
            if m.get('Your Rating') is not None and m.get('Genres'):
                genres = m['Genres'].split(', ')
                all_genres.extend(genres)
        
        if all_genres:
            from collections import Counter
            top_genres = Counter(all_genres).most_common(5)
            print(f"\n   Top genres you've rated:")
            for genre, count in top_genres:
                print(f"      {genre}: {count} movies")
    
    print(f"\n📄 Output file: {output_file}")
    print(f"   Size: {Path(output_file).stat().st_size / 1024:.1f} KB")
    print("\n🚀 Ready to import to TasteMap!")

if __name__ == "__main__":
    convert_imdb_to_json()
