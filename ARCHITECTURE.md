# TasteMap: High-Level Architecture

## 1. Overview
TasteMap employs a client-side heavy architecture, initially designed for a `vanilla-canvas` implementation. The core logic for visualization and user interaction resides within the browser. For a full-fledged application, a backend component would handle data persistence, extensive movie data, and more complex recommendation algorithms. This document outlines the key components and their interactions.

## 2. Core Components

### 2.1. Frontend Application (Client-Side)
This is the primary component, responsible for all user-facing interactions and visualizations.

-   **UI Layer (HTML/CSS)**: Provides the structural layout and styling for the application, including search bars, rating inputs, and display areas.
-   **Application Logic (JavaScript)**: Manages user input, application state, data fetching (from local storage or API), and orchestrates the visualization.
-   **Visualization Layer (Canvas API)**: Utilizes the HTML5 Canvas element to render dynamic and interactive charts (radar charts, scatter plots) that represent the user's taste profile.
-   **Data Management (Client-side)**: Initially uses `localStorage` or `sessionStorage` for storing user ratings and derived taste profiles. Will interact with a backend API for persistent storage in a full implementation.

### 2.2. Backend Services (Future / Optional)
While not strictly part of the initial `vanilla-canvas` scaffold, a robust TasteMap would benefit from backend services.

-   **API Gateway**: Acts as the entry point for all client requests, routing them to appropriate backend services.
-   **User Service**: Manages user authentication, profiles, and preferences.
-   **Movie Data Service**: Integrates with external movie databases (e.g., TMDB, OMDb) to fetch movie details and attributes. Can also pre-process and store attributes.
-   **Rating Service**: Handles the persistence of user ratings.
-   **Taste Profile & Recommendation Engine**: Processes user ratings and movie attributes to generate taste profiles and deliver personalized recommendations. This could involve machine learning models.
-   **Database**: Stores all persistent data, including users, movies, ratings, and pre-calculated taste profiles/attributes (e.g., PostgreSQL, MongoDB).

## 3. Data Flow and Interactions

1.  **User Interaction**: A user interacts with the Frontend Application (e.g., searches for a movie, rates a movie).
2.  **Data Update (Client-side)**: The Frontend processes the rating, updates the local taste profile data, and triggers a re-render of the visualization.
3.  **API Call (Future)**: For persistent storage, the Frontend would send a request to the Backend API (e.g., `POST /ratings`).
4.  **Backend Processing (Future)**: The Backend API receives the request, updates the database, and potentially triggers a recalculation of the user's taste profile and recommendations.
5.  **Data Retrieval (Client-side)**: The Frontend fetches updated taste profile data and recommendations from local storage or the Backend API (e.g., `GET /users/{id}/profile`).
6.  **Visualization Render**: The Canvas API renders the updated taste profile and recommendations visually.

## 4. Architectural Diagram

```mermaid
graph TD
    A[User] -->|Interacts via| B(Frontend Application);
    B -->|1. Search/Rate Movie| C{Client-Side Logic};
    C -->|2. Update Local State/Storage| D[Local Data Store (localStorage)];
    C -->|3. Render/Update| E[Canvas Visualization];

    subgraph Backend (Future Integration)
        F[API Gateway] --> G[User Service];
        F --> H[Movie Data Service];
        F --> I[Rating Service];
        F --> J[Taste Profile & Recommendation Engine];
        G -- DB --> K[Database];
        H -- DB --> K;
        I -- DB --> K;
        J -- DB --> K;
    end

    C -- (Optional) 4. API Calls --> F;
    F -- (Optional) 5. Data Retrieval --> C;
```