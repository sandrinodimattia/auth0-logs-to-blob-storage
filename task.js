"use latest";

const Auth0 = require('auth0@0.8.2');
const moment = require('moment');
const azure = require('azure-storage');
const useragent = require('useragent');
const waterfall   = require('async').waterfall;

const getCheckpointId = (history) => {
  if (history && history.length > 0) {
    console.log('Trying to get last checkpointId from previous run.');

    for (var i = 0; i < history.length; i++) {
      console.log (` > Run: ${history[i].started_at} - ${history[i].type}`);

      if (history[i].statusCode === 200 && history[i].body){
        var result = JSON.parse(history[i].body);
        if (result && result.checkpointId) {

          console.log (` > This is the last one we want to continue from: ${result.checkpointId}`);
          return result.checkpointId;
        }
      }
    };
  }
}

module.exports = (ctx, done) => {
  var required_settings = ['AUTH0_DOMAIN', 'AUTH0_GLOBAL_CLIENT_ID', 'AUTH0_GLOBAL_CLIENT_SECRET', 'STORAGE_ACCOUNT_NAME', 'STORAGE_ACCOUNT_KEY', 'STORAGE_CONTAINER_NAME'];
  var missing_settings = required_settings.filter((setting) => !ctx.data[setting]);
  if (missing_settings.length) {
    return done({ message: 'Missing settings: ' + missing_settings.join(', ') });
  }

  // If this is a scheduled task, we'll get the last log checkpoint from the previous run and continue from there.
  let startCheckpointId = getCheckpointId(ctx.body && ctx.body.results);

  // Initialize both clients.
  const auth0 = new Auth0({
     domain: ctx.data.AUTH0_DOMAIN,
     clientID: ctx.data.AUTH0_GLOBAL_CLIENT_ID,
     clientSecret: ctx.data.AUTH0_GLOBAL_CLIENT_SECRET
  });
  const blobService = azure.createBlobService(ctx.data.STORAGE_ACCOUNT_NAME, ctx.data.STORAGE_ACCOUNT_KEY);

  // Start the process.
  async.waterfall([
    (callback) => {
      auth0.getAccessToken((err) => {
        if (err) {
          console.log('Error authenticating:', err);
        }
        return callback(err);
      });
    },
    (callback) => {
      try {
        blobService.createContainerIfNotExists(ctx.data.STORAGE_CONTAINER_NAME, (err) => callback(err));
      } catch (e) {
        return callback(e);
      }
    },
    (callback) => {
      const getLogs = (context) => {
        console.log(`Downloading logs from: ${context.checkpointId || 'Start'}.`);

        context.logs = context.logs || [];
        auth0.getLogs({ take: 200, from: context.checkpointId }, (err, logs) => {
          if (err) {
            return callback(err);
          }

          if (logs && logs.length) {
            logs.forEach((l) => context.logs.push(l));
            context.checkpointId = context.logs[context.logs.length - 1]._id;
            return setImmediate(() => getLogs(context));
          }

          console.log(`Total logs: ${context.logs.length}.`);
          return callback(null, context);
        });
      };

      getLogs({ checkpointId: startCheckpointId });
    },
    (context, callback) => {
      context.logs = context.logs.map((record) => {
        var level = 0;
        record.type_code = record.type;
        if (logTypes[record.type]) {
          level = logTypes[record.type].level;
          record.type = logTypes[record.type].event;
        }

        var agent = useragent.parse(record.user_agent);
        record.os = agent.os.toString();
        record.os_version = agent.os.toVersion();
        record.device = agent.device.toString();
        record.device_version = agent.device.toVersion();
        return record;
      });
      callback(null, context);
    },
    (context, callback) => {
      console.log('Uploading blobs...');

      async.eachLimit(context.logs, 5, (log, cb) => {
        const date = moment(log.date);
        const url = `${date.format('YYYY/MM/DD')}/${date.format('HH')}/${log._id}.json`;
        console.log(`Uploading ${url}.`);

        blobService.createBlockBlobFromText(ctx.data.STORAGE_CONTAINER_NAME, url, JSON.stringify(log), cb);
      }, (err) => {
        if (err) {
          return callback(err);
        }

        console.log('Upload complete.');
        return callback(null, context);
      });
    }
  ], function (err, context) {
    if (err) {
      console.log('Job failed.')
      return done({ error: err }, {
        checkpointId: startCheckpointId
      });
    }

    console.log('Job complete.');
    return done(null, {
      checkpointId: context.checkpointId,
      totalLogsProcessed: context.logs.length
    });
  });
};

const logTypes = {
  's': {
    event: 'Success Login',
    level: 1 // Info
  },
  'seacft': {
    event: 'Success Exchange',
    level: 1 // Info
  },
  'feacft': {
    event: 'Failed Exchange',
    level: 3 // Error
  },
  'f': {
    event: 'Failed Login',
    level: 3 // Error
  },
  'w': {
    event: 'Warnings During Login',
    level: 2 // Warning
  },
  'du': {
    event: 'Deleted User',
    level: 1 // Info
  },
  'fu': {
    event: 'Failed Login (invalid email/username)',
    level: 3 // Error
  },
  'fp': {
    event: 'Failed Login (wrong password)',
    level: 3 // Error
  },
  'fc': {
    event: 'Failed by Connector',
    level: 3 // Error
  },
  'fco': {
    event: 'Failed by CORS',
    level: 3 // Error
  },
  'con': {
    event: 'Connector Online',
    level: 1 // Info
  },
  'coff': {
    event: 'Connector Offline',
    level: 3 // Error
  },
  'fcpro': {
    event: 'Failed Connector Provisioning',
    level: 4 // Critical
  },
  'ss': {
    event: 'Success Signup',
    level: 1 // Info
  },
  'fs': {
    event: 'Failed Signup',
    level: 3 // Error
  },
  'cs': {
    event: 'Code Sent',
    level: 0 // Debug
  },
  'cls': {
    event: 'Code/Link Sent',
    level: 0 // Debug
  },
  'sv': {
    event: 'Success Verification Email',
    level: 0 // Debug
  },
  'fv': {
    event: 'Failed Verification Email',
    level: 0 // Debug
  },
  'scp': {
    event: 'Success Change Password',
    level: 1 // Info
  },
  'fcp': {
    event: 'Failed Change Password',
    level: 3 // Error
  },
  'sce': {
    event: 'Success Change Email',
    level: 1 // Info
  },
  'fce': {
    event: 'Failed Change Email',
    level: 3 // Error
  },
  'scu': {
    event: 'Success Change Username',
    level: 1 // Info
  },
  'fcu': {
    event: 'Failed Change Username',
    level: 3 // Error
  },
  'scpn': {
    event: 'Success Change Phone Number',
    level: 1 // Info
  },
  'fcpn': {
    event: 'Failed Change Phone Number',
    level: 3 // Error
  },
  'svr': {
    event: 'Success Verification Email Request',
    level: 0 // Debug
  },
  'fvr': {
    event: 'Failed Verification Email Request',
    level: 3 // Error
  },
  'scpr': {
    event: 'Success Change Password Request',
    level: 0 // Debug
  },
  'fcpr': {
    event: 'Failed Change Password Request',
    level: 3 // Error
  },
  'fn': {
    event: 'Failed Sending Notification',
    level: 3 // Error
  },
  'sapi': {
    event: 'API Operation'
  },
  'fapi': {
    event: 'Failed API Operation'
  },
  'limit_wc': {
    event: 'Blocked Account',
    level: 4 // Critical
  },
  'limit_ui': {
    event: 'Too Many Calls to /userinfo',
    level: 4 // Critical
  },
  'api_limit': {
    event: 'Rate Limit On API',
    level: 4 // Critical
  },
  'sdu': {
    event: 'Successful User Deletion',
    level: 1 // Info
  },
  'fdu': {
    event: 'Failed User Deletion',
    level: 3 // Error
  }
};
