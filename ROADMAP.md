# MVP
1. Choose a technological stack:
   1. HTTP server:
      1. [hyper](https://crates.io/crates/hyper)
      2. [Tower Web](https://crates.io/crates/tower-web)
      3. [Tide](https://crates.io/crates/tide)
   2. HTTP client:
      1. [reqwest](https://crates.io/crates/reqwest)
      2. [Surf](https://crates.io/crates/surf)
   3. PostgreSQL driver:
      1. [tokio-postgres](https://crates.io/crates/tokio-postgres)
   4. PostgreSQL connection pool:
      1. [bb8](https://crates.io/crates/bb8)
      2. [L3-37](https://github.com/OneSignal/L3-37)
      3. Custom connection pool
2. Set up сontinuous integration testing and deployment.
3. Implement a simple payment acceptance API and test it.
4. Implement a user authentication system and test it.
5. Implement a handler when accepting a payment that credits tokens from the
   reserve fund to the payer's account and test it.
6. Write documentation, integrate with the android application.
7. Clarify hardware requirements, buy VPS for production.
8. Find a way to securely store keys for signing a transaction and interacting
   with a bank.
9. Make sure that no one has access to the keys to the production server, bank
   account or account in the blockchain except for the manager responsible for
   this.
10. The first release of the release version by the responsible manager on the
   production server.
