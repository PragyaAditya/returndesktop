Two links, both on the application form on the role page: your deployed application, and a public GitHub repository.

ReturnDesk must be live at a public URL we can open and use, with its database attached and the seed data loaded. We will click through the working application before we read a single line of your code. Vercel, Render, Railway, Fly and Netlify all have free tiers, as do Neon and Supabase for Postgres. If you cannot get it deployed in time, submit the repository anyway and explain in your README what went wrong and how far you got. A missing deployment is a real gap, but hiding it is worse.

The repository holds the complete source code; the deployed URL, in the README and in the repository description; a README.md with setup steps that work from a clean machine, database setup, how to run the seed script, the design decisions you made and why, what is incomplete and any assumptions; a .env.example listing every environment variable needed, with your real .env never committed; whatever your project needs to build its database from empty, and the seed script; and a short note on roughly how many hours you actually spent.

What fails a submission outright
Data that does not persist in PostgreSQL
A repository that cannot be run by following its own README
A README describing features that are not implemented
Work that is clearly copied wholesale and cannot be explained in the technical round
How the assignment is scored
Area and weight	What we look for
Business rules · 25	All five rules enforced, and enforced on the server. Illegal transitions, duplicates and locked records all refused correctly and reported clearly.
Data model · 20	A schema that fits the problem. Correct types, real constraints, sensible relationships, uniqueness where it belongs. Filtering, sorting and paging done in SQL.
API design · 20	A coherent, predictable API. Sensible resources and naming, consistent response and error shapes, honest use of HTTP semantics.
Frontend · 20	Clear and functional interface. Only legal actions offered. All states handled. Server errors surfaced. Responsive.
Code quality · 10	Readable structure, sensible naming, validation logic not duplicated across the codebase, no dead code, no secrets committed.
Submission · 5	Deployed and working at a public URL. README accurate and complete, setup works from clean, seed data present, commit history shows real progression.