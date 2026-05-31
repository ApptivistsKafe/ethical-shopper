## 2025-09-15 - Reddit API Wrapper Alternative (PRAW)

**Context:** User inquired about potentially replacing `snoowrap` with PRAW in the Node.js backend for Reddit API interactions, possibly due to perceived limitations or performance concerns with `snoowrap`'s `expandReplies` behavior.

**Decision:** No immediate implementation. This is an architectural suggestion for future consideration. The current `snoowrap` implementation has been optimized by manually limiting comments.

**Rationale:** PRAW is a mature and feature-rich Python library for Reddit API. Integrating it would allow leveraging its capabilities, potentially offering more granular control or better performance for specific Reddit API interactions. However, it introduces significant architectural complexity by adding Python as a new dependency and requiring inter-process communication. This overhead needs to be carefully weighed against any concrete benefits.

**Architectural Implications:**

- **Technology Stack Expansion**: Introduces Python runtime and dependencies.
- **Inter-process Communication (IPC)**: Requires Node.js to spawn child Python processes, passing data via stdin/stdout, which adds overhead.
- **Development/Deployment Complexity**: Increases complexity for development (two languages) and deployment (managing two runtimes).
- **Error Handling**: Requires robust IPC error handling.

**Next Steps (for future consideration):**

1.  Conduct performance benchmarks between optimized `snoowrap` and a PRAW prototype.
2.  Assess feature parity and specific use-case benefits of PRAW.
3.  Evaluate long-term operational overhead.
