# Auth0 - Logs to Azure Blob Storage

A webtask that will take all of your Auth0 logs and export them to Azure Blob Storage.

## Configure Azure Blob Storage

First you'll need to [create an Azure Storage account](https://portal.azure.com/#create/Microsoft.StorageAccount.1.0.0).

## Configure Webtask

If you haven't configured Webtask on your machine run this first:

```
npm i -g wt-cli
wt init
```

> Requires at least node 0.10.40 - if you're running multiple version of node make sure to load the right version, e.g. "nvm use 0.10.40"

## Deployment

If you just want to run it once:

```
wt create https://raw.githubusercontent.com/sandrinodimattia/auth0-logs-to-blob-storage-webtask/master/task.js \
    --name auth0-logs-to-blob-storage \
    --secret AUTH0_DOMAIN={YOUR_AUTH0_DOMAIN} \
    --secret AUTH0_GLOBAL_CLIENT_ID={YOUR_AUTH0_GLOBAL_CLIENT_ID} \
    --secret AUTH0_GLOBAL_CLIENT_SECRET={YOUR_AUTH0_GLOBAL_CLIENT_SECRET} \
    --secret STORAGE_ACCOUNT_NAME={YOUR_STORAGE_ACCOUNT_NAME} \
    --secret STORAGE_ACCOUNT_KEY={YOUR_STORAGE_ACCOUNT_KEY} \
    --secret STORAGE_CONTAINER_NAME={YOUR_STORAGE_CONTAINER_NAME}
```

If you want to run it on a schedule (run every 5 minutes for example):

```
wt cron schedule \
    --name auth0-logs-to-blob-storage \
    --secret AUTH0_DOMAIN={YOUR_AUTH0_DOMAIN} \
    --secret AUTH0_GLOBAL_CLIENT_ID={YOUR_AUTH0_GLOBAL_CLIENT_ID} \
    --secret AUTH0_GLOBAL_CLIENT_SECRET={YOUR_AUTH0_GLOBAL_CLIENT_SECRET} \
    --secret STORAGE_ACCOUNT_NAME={YOUR_STORAGE_ACCOUNT_NAME} \
    --secret STORAGE_ACCOUNT_KEY={YOUR_STORAGE_ACCOUNT_KEY} \
    --secret STORAGE_CONTAINER_NAME={YOUR_STORAGE_CONTAINER_NAME} \
    --json \
    "*/5 * * * *" \
    https://raw.githubusercontent.com/sandrinodimattia/auth0-logs-to-blob-storage-webtask/master/task.js
```

> You can get your Global Client Id/Secret here: https://auth0.com/docs/api/v1

## Usage

Use any Storage Explorer to access your logs. Each record will be saved in the following structure:

```
https://{YOUR_STORAGE_ACCOUNT_NAME}.blob.core.windows.net/{YOUR_STORAGE_CONTAINER_NAME}/YYYY/MM/DD/HH/{LOG_ID}.json
```

This will allow you to process the logs with Stream Analytics for example (which in turn can export them to Power BI).
