'use strict';
const oauth2orize = require('oauth2orize');
const periodic = require('periodicjs');
const oauth2util = require('./oauth2');
const CodeCoreData = periodic.data.get('standard_code');

/**
 * Register serialialization function
 * @param  {object} client    client from db
 * @param  {function} callback) {	            return callback(null, client._id);	} client id from db
 */
function serializeClient(client, callback) {
  return callback(null, client._id);
}

// Register deserialization function
/**
 * Register deserialization function
 * @param  {string} id        client id
 * @param  {function} callback) {	                   Client.findOne({ _id: id } pull client from db by client_id
 * @return  {function} callback function  (err,         client) {	                          if            (err) { return callback(err); }	    return callback(null, client);	  });	} returns client object
 */
function deserializeClient(id, callback) {
  CodeCoreData
    .load({
      query: {
        _id: id,
      }
    })
    .then(client => {
      return callback(null, client);
    })
    .catch(err => {
      return callback(err, false);
    });
}

/**
 * Register authorization code grant type
 * OAuth 2.0 specifies a framework that allows users to grant client applications limited access to their protected resources. It does this through a process of the user granting access, and the client exchanging the grant for an access token.
 * 
 * We are registering here for an authorization code grant type. We create a new authorization code model for the user and application client. It is then stored in MongoDB so we can access it later when exchanging for an access token.
 * @param  {object} client      client from db
 * @param  {string} redirectUri redirect path for user
 * @param  {object} user        user from db
 * @return {function}             callback function
 */
function grantCode(client, redirectUri, user, ares, callback) {
  // Create a new authorization code
  // Save the auth code and check for errors
  CodeCoreData
    .create({
      newdoc: {
        value: oauth2util.uid(16),
        client_id: client._id,
        redirect_uri: redirectUri,
        user_id: user._id,
        user_username: user.username,
        user_email: user.email,
        user_entity_type: user.entitytype
      },
    })
    .then(code => { 
      console.log('in code callback', { code, callback });
      callback(null, code.value);
    })
    .catch(callback);
}

/**
 * exchange auth code
 * 
 * @param {any} client 
 * @param {any} code 
 * @param {any} redirectUri 
 * @param {any} callback 
 */
function exchangeCode(client, code, redirectUri, callback) {
  CodeCoreData.load({ query: { value: code }, })
    .then(authCode => {
      console.log({ authCode, client });
      if (authCode === undefined || !authCode) {
        return callback(null, false);
      } else if (client._id.toString() !== authCode.client_id.toString()) {
        return callback(null, false);
      } else if (redirectUri !== authCode.redirect_uri) {
        return callback(null, false);
      } else {
        // Delete auth code now that it has been used
        return CodeCoreData.delete({
          id: authCode._id,
        });
      }
    })
    .then(deletedCode => {
      console.log({ deletedCode });
      // Create a new access token
      // Save the access token and check for errors
      return periodic.data.get('standard_token')
        .create({
          newdoc: {
            value: uid(256),
            client_id: authCode.client_id,
            user_id: authCode.user_id,
            user_username: authCode.user_username,
            user_email: authCode.user_email,
            user_entity_type: authCode.user_entity_type,
          },
        });
    })
    .then(newToken => {
      console.log({ newToken });
      return callback(null, newToken);
    })
    .catch(callback);
}

/**
 * look up client by client ID
 * 
 * @param {any} clientId 
 * @param {any} redirectUri 
 * @param {any} callback 
 */
function authorization(clientId, redirectUri, callback) {
  // console.log('looking up client',clientId, redirectUri);
  periodic.data.get('standard_client')
    .load({ query: { client_id: clientId }, })
    .then(client => {
      callback(null, client, redirectUri);
    })
    .catch(callback);
}

module.exports = {
  serializeClient,
  deserializeClient,
  oauth2orizeGrantCode: oauth2orize.grant.code(grantCode),
  oauth2orizeExchangeCode: oauth2orize.exchange.code(exchangeCode),
  authorization,
};