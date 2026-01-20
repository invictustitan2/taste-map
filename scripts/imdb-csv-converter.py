#!/usr/bin/env python3
"""
IMDB CSV to JSON Converter for TasteMap
No external dependencies - uses only Python standard library

Usage:
    python3 imdb-csv-converter.py

Input files (expected in same directory):
    - df7fd8ec373b4c9ab88ef1a738569519.csv (ratings)
    - 808440a1a6fb4e03ac871d004ecbdbcf.csv (watchlist)

Output:
    - ratings.json (combined, deduplicated movies only)
"""

import csv
import json
from pathlib import Path
from collections import Counter

def read_csv_file(filename):
    """Read CSV file and return list of dictionaries."""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return list(reader)
    except FileNotFoundError:
        return None

def convert_value(value, field_name):
    """Convert string values to appropriate types."""
    if value is None or value == '':
        return None
    
    # Integer fields
    int_fields = ['Your Rating', 'Runtime (mins)', 'Year', 'Num Votes', 'Position']
    if field_name in int_fields:
        try:
            return int(value)
        except (ValueError, TypeError):
            return None
    
    # Float fields
    float_fields = ['IMDb Rating']
    if field_name in float_fields:
        try:
            return float(value)
        except (ValueError, TypeError):
            return None
    
    # String fields - return as-is
    return value

def clean_movie_record(record, keep_columns):
    """Clean and convert a movie record."""
    cleaned = {}
    for col in keep_columns:
        if col in record:
            cleaned[col] = convert_value(record[col], col)
    return cleaned

def merge_records(movies_dict):
    """Merge duplicate movies, keeping first occurrence."""
    seen = {}
    for movie in movies_dict:
        imdb_id = movie.get('Const')
        if imdb_id and imdb_id not in seen:
            seen[imdb_id] = movie
    return list(seen.values())

def convert_imdb_to_json():
    """Main conversion function."""
    # File paths
    ratings_file = "df7fd8ec-373b-4c9a-b88e-f1a738569519.csv"
    watchlist_file = "808440a1-a6fb-4e03-ac87-1d004ecbdbcf.csv"
    output_file = "ratings.json"
    
    print("🎬 TasteMap IMDB Converter (No Dependencies)")
    print("=" * 50)
    
    # Columns to keep
    keep_columns = [
        'Const', 'Title', 'Original Title', 'Title Type',
        'IMDb Rating', 'Runtime (mins)', 'Year', 'Genres',
        'Num Votes', 'Release Date', 'Directors',
        'Your Rating', 'Date Rated', 'URL'
    ]
    
    # Read ratings CSV
    print(f"\n📊 Reading {ratings_file}...")
    ratings_data = read_csv_file(ratings_file)
    if ratings_data is None:
        print(f"   ❌ File not found: {ratings_file}")
        return
    print(f"   Found {len(ratings_data)} rated items")
    
    # Read watchlist CSV
    print(f"\n📊 Reading {watchlist_file}...")
    watchlist_data = read_csv_file(watchlist_file)
    if watchlist_data is None:
        print(f"   ❌ File not found: {watchlist_file}")
        return
    print(f"   Found {len(watchlist_data)} watchlist items")
    
    # Clean and merge data
    print("\n🔄 Processing and merging data...")
    
    all_movies = []
    
    # Process ratings (priority)
    for record in ratings_data:
        cleaned = clean_movie_record(record, keep_columns)
        all_movies.append(cleaned)
    
    # Process watchlist
    for record in watchlist_data:
        cleaned = clean_movie_record(record, keep_columns)
        all_movies.append(cleaned)
    
    # Merge duplicates (keeps first = ratings)
    merged_movies = merge_records(all_movies)
    
    # Filter to movies only
    print("\n🎥 Analyzing Title Types...")
    
    # First, let's see what title types we have
    title_types = Counter(m.get('Title Type') for m in merged_movies if m.get('Title Type'))
    print(f"   Found title types: {dict(title_types)}")
    
    # Filter to movies (case-insensitive, handle variations)
    movies_only = [
        m for m in merged_movies 
        if m.get('Title Type') and m.get('Title Type').lower() in ['movie', 'tvmovie']
    ]
    print(f"   {len(movies_only)} movies (filtered out {len(merged_movies) - len(movies_only)} non-movies)")
    
    # Write to JSON
    print(f"\n💾 Writing to {output_file}...")
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(movies_only, f, indent=2, ensure_ascii=False)
    
    # Summary statistics
    rated_count = sum(1 for m in movies_only if m.get('Your Rating') is not None)
    unwatched_count = len(movies_only) - rated_count
    
    print("\n✅ Conversion complete!")
    print("=" * 50)
    print(f"📈 Summary:")
    print(f"   Total movies: {len(movies_only)}")
    print(f"   Rated movies: {rated_count}")
    print(f"   Watchlist (unrated): {unwatched_count}")
    
    if rated_count > 0:
        # Calculate average rating
        ratings = [m['Your Rating'] for m in movies_only if m.get('Your Rating') is not None]
        avg_rating = sum(ratings) / len(ratings)
        print(f"   Average rating: {avg_rating:.1f}/10")
        
        # Genre distribution for rated movies
        all_genres = []
        for m in movies_only:
            if m.get('Your Rating') is not None and m.get('Genres'):
                genres = m['Genres'].split(', ')
                all_genres.extend(genres)
        
        if all_genres:
            top_genres = Counter(all_genres).most_common(5)
            print(f"\n   Top genres you've rated:")
            for genre, count in top_genres:
                print(f"      {genre}: {count} movies")
    
    file_size = Path(output_file).stat().st_size / 1024
    print(f"\n📄 Output file: {output_file}")
    print(f"   Size: {file_size:.1f} KB")
    print("\n🚀 Ready to import to TasteMap!")

if __name__ == "__main__":
    convert_imdb_to_json()
