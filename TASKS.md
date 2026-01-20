# TasteMap: MVP Tasks & Verification

This document outlines the Minimum Viable Product (MVP) tasks for TasteMap, categorized into phases, along with verification steps to ensure successful implementation.

## Phase 1: Core Data & Visualization

### Tasks
-   [ ] **Define Quantifiable Film Attributes**: Establish a clear set of attributes (e.g., 5-7 key genres, 3-5 mood descriptors, a few thematic tags, director influence score) that can be assigned to movies and used for taste mapping.
-   [ ] **Design Basic Data Model**: Create JavaScript objects/structures for `Movie` (with attributes) and `Rating`. Implement a simple in-memory or `localStorage` based data store.
-   [ ] **Implement Minimal Movie Data Input/Mocking**: Allow for adding a few sample movies with pre-defined attributes, or integrate a simple mock API to fetch movie data.
-   [ ] **Develop Basic Rating Mechanism**: Create UI elements (e.g., buttons, stars) to allow users to rate a movie.
-   [ ] **Create UI Element for Taste Visualization**: Using the Canvas API, develop a basic 2D visualization (e.g., a simple radar chart or a 2-axis scatter plot) that can display a user's aggregated taste based on their rated movies.
-   [ ] **Connect Ratings to Visualization**: Ensure that when a user rates a movie, their taste profile is calculated based on the movie's attributes, and the visualization updates accordingly.

### Verification Steps
-   [ ] Can a developer easily add new mock movie data with attributes?
-   [ ] Can a user rate a movie via the UI?
-   [ ] Does the visualization appear on the screen and update dynamically after a movie is rated?
-   [ ] Does the visualization (e.g., radar chart points, scatter plot position) visually change in a way that logically reflects the attributes of the rated movie?
-   [ ] Are the film attributes used for mapping clearly defined and consistently applied to mock data?

## Phase 2: Recommendation & Exploration

### Tasks
-   [ ] **Implement Basic Taste Profile Generation**: Develop an algorithm to aggregate attributes from all rated movies into a single user taste profile (e.g., average score per attribute, weighted sum).
-   [ ] **Develop Basic Recommendation Logic**: Implement a simple algorithm to suggest movies that are "similar" to the user's taste profile or specific rated movies.
-   [ ] **Allow Exploration within Taste Map**: Enable users to click on regions of their taste map or specific attributes to view recommended movies within that taste cluster.
-   [ ] **Implement Search/Filter Functionality**: Allow users to search for movies and filter the display based on attributes, even before rating them.

### Verification Steps
-   [ ] After rating several movies, do the recommendations provided seem relevant to the user's expressed taste?
-   [ ] Can a user click on a segment of the visualization (e.g., 'Action' genre axis on a radar chart) and see movies that align with that segment?
-   [ ] Does the search functionality correctly filter and display movies based on input criteria?
-   [ ] Is the taste profile generation algorithm producing consistent and explainable results?

## Phase 3: Polish & Usability

### Tasks
-   [ ] **Improve UI/UX**: Refine the visual design and user flow for rating, visualization, and recommendations.
-   [ ] **Add Persistent Storage**: Implement saving/loading of user ratings and taste profiles using `localStorage` to retain data across sessions.
-   [ ] **Implement Basic Error Handling & Feedback**: Provide clear messages for invalid inputs, loading states, or other issues.
-   [ ] **Responsive Design**: Ensure the application is usable across different screen sizes.
-   [ ] **Basic Accessibility**: Implement fundamental accessibility features (e.g., keyboard navigation for basic UI elements).

### Verification Steps
-   [ ] Is the application intuitive and pleasant to use, even for first-time users?
-   [ ] Do user ratings and their taste profile persist after closing and reopening the browser tab?
-   [ ] Are error messages user-friendly and helpful?
-   [ ] Is the application functional and visually appealing on both desktop and mobile browsers?
-   [ ] Can core interactions be performed using keyboard navigation alone?