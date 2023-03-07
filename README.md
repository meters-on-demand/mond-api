# Meters on Demand API

Meters on Demand backend for accessing, searching, updating and adding to the skins database.

# Developing or running a local instance of the API

```sh
git clone https://github.com/meters-on-demand/mond-api.git
cd mond-api
touch .env
```

The .env file must contain the following values:

```sh
# URL of your mongodb instance or Atlas cluster.
# Defaults to a local mongodb instance
MONGO_URL=mongodb://127.0.0.1:27017/mond
# The port to run the API on
PORT=80
# A GitHub Personal Access Token to use when accessing GitHubs API.
# If not added you will get rate limited by GitHub very quickly.
GITHUB_PAT=
# Uncomment to enable request logging
# LOGGING=TRUE
```
