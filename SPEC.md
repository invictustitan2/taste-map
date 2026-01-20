# TasteMap: Technical Specification

## 1. Introduction
TasteMap aims to provide an intuitive and interactive platform for users to visualize and understand their movie preferences. By processing user ratings and film attributes, the application generates a dynamic 'taste profile' and offers personalized recommendations. This document outlines the technical requirements, features, and architectural considerations for the TasteMap application.

## 2. Goals
-   To create a highly interactive and visually engaging user experience.
-   To accurately represent a user's film preferences through data visualization.
-   To provide relevant and personalized movie recommendations.
-   To build a scalable and maintainable codebase.

## 3. Key Features

### 3.1. User Interaction & Data Input
-   **Movie Search**: Allow users to search for movies from a predefined or external database.
-   **Rating System**: Implement a clear and simple mechanism for users to rate movies (e.g., 1-5 stars, like/dislike).
-   **Taste Profile Generation**: Algorithmically derive a user's taste profile based on their rated movies and associated film attributes.

### 3.2. Visualization
-   **Interactive 2D Canvas Visualization**: Utilize HTML5 Canvas for rendering dynamic charts (e.g., radar charts for multi-attribute comparison, scatter plots for genre distribution).
-   **Dynamic Updates**: Visualization updates in real-time or near real-time as users rate new movies.
-   **Attribute Drill-down**: Allow users to click or hover on parts of the visualization to see details about specific attributes or movies.

### 3.3. Recommendation & Exploration
-   **Personalized Recommendations**: Suggest movies that align with the user's taste profile, potentially highlighting areas where their taste is developing.
-   **Taste Map Exploration**: Enable users to explore movies within specific regions or clusters of their taste map.
-   **Filtering & Sorting**: Provide options to filter recommendations or displayed movies by various attributes (genre, director, actors, year).

### 3.4. Data Management
-   **Film Attribute Data**: Define and manage a comprehensive set of quantifiable film attributes (e.g., Genre, Director, Lead Actors, Themes, Mood, Pace, Visual Style).
-   **User Data Storage**: Persist user ratings and taste profiles (initially via local storage, later potentially a backend).

## 4. Data Model (Conceptual)

-   **User**: `id`, `name`, `ratings` (array of Rating objects), `tasteProfile` (object representing attributes).
-   **Movie**: `id`, `title`, `release_year`, `poster_url`, `attributes` (object mapping attribute name to value/score).
-   **Rating**: `user_id`, `movie_id`, `score` (1-5), `timestamp`.
-   **FilmAttribute**: `name` (e.g., 'Action', 'Drama', 'Christopher Nolan'), `type` (e.g., 'Genre', 'Director', 'Mood').

## 5. Technical Stack

### 5.1. Frontend
-   **HTML5, CSS3, JavaScript (ES6+)**: Core development languages.
-   **Canvas API**: For all custom 2D graphics and visualizations.
-   **No major UI framework (e.g., React, Vue)**: Focus on vanilla JavaScript for maximum control and minimal overhead, aligning with `vanilla-canvas` scaffold.
-   **Potential Libraries**: `Chart.js` or `D3.js` could be considered for advanced charting if Canvas API implementation becomes too complex for specific chart types.

### 5.2. Backend (Future Consideration / API Mocking)
-   Initially, data will be mocked or stored in local storage for the `vanilla-canvas` scaffold.
-   For a full-scale application, a backend would be required for:
    -   User Authentication and Management.
    -   Persistent User Ratings and Profiles.
    -   Large-scale Movie Database integration (e.g., TMDB API).
    -   Complex Recommendation Engine logic.
    -   Technologies: Node.js (Express), Python (Flask/Django), Go, etc. with a database like PostgreSQL or MongoDB.

## 6. API Endpoints (Conceptual for future backend integration)
-   `GET /movies`: Retrieve a list of movies, potentially with filters.
-   `GET /movies/{id}`: Get details for a specific movie.
-   `POST /ratings`: Submit a new movie rating for a user.
-   `GET /users/{id}/profile`: Retrieve a user's taste profile.
-   `GET /users/{id}/recommendations`: Get personalized movie recommendations.

## 7. Deployment
-   The frontend can be deployed as static files on platforms like Netlify, Vercel, GitHub Pages, or any static web server.
-   If a backend is integrated, it would require a server environment (e.g., AWS EC2, Heroku, Google Cloud Run).

## 8. Future Considerations
-   User authentication and profiles.
-   Integration with external movie databases (e.g., TMDB).
-   More sophisticated recommendation algorithms (e.g., collaborative filtering).
-   Sharing and social features.
-   Accessibility improvements for visualizations.