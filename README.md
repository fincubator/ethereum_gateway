[![License]][LICENSE.md]
[![Telegram]][Teletram join]

--------------------------------------------------------------------------------

[Payment gateway][Teletram join] is a payment gateway between two different
blockchains.

# Requirements
* [Docker] (19.03.5, 18.09.7 tested)
* [Docker Compose] (1.24.1 tested)
* [Node.js] (10.16.0 tested)
* [NPM] (6.9.0 tested)
* [PostgreSQL] (12.1 tested)
* [Redis] (5.0.7 tested)
* [Go Ethereum], [Parity Ethereum] or many other RPC providers like [Infura]
* [BitShares Core] or many other RPC providers like [blckchnd]

# Installation in Docker
1. Install git, Docker, Docker Compose:
```bash
sudo apt install git docker.io docker-compose
```
2. Clone the repository:
```bash
git clone https://github.com/fincubator/payment-gateway
cd payment-gateway
```
3. Set the environment variables listed in the [config.app.ts] file in the .env
   file
4. Start the services by running the command:
```bash
sudo docker-compose up
```

# Contributing
You can help by working on opened issues, fixing bugs, creating new features or
improving documentation.

Before contributing, please read [CONTRIBUTING.md] first.

# License
Payment gateway is released under the GNU Affero General Public License v3.0.
See [LICENSE.md] for the full licensing condition.

[License]: https://img.shields.io/github/license/fincubator/payment-gateway
[LICENSE.md]: LICENSE.md
[CONTRIBUTING.md]: CONTRIBUTING.md
[Telegram]: https://img.shields.io/badge/Telegram-fincubator-blue?logo=telegram
[Teletram join]: https://t.me/fincubator
[Docker]: https://www.docker.com
[Docker Compose]: https://www.docker.com
[Node.js]: https://nodejs.org/en
[NPM]: https://www.npmjs.com
[PostgreSQL]: https://www.postgresql.org
[Redis]: https://redis.io
[Go Ethereum]: https://geth.ethereum.org
[Parity Ethereum]: https://www.parity.io/ethereum
[Infura]: https://infura.io
[BitShares Core]: https://bitshares.org
[blckchnd]: https://blckchnd.com
[config.app.ts]: src/config/config.app.ts
[config.db.ts]: src/config/config.db.ts
