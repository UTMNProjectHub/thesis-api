// GENERATED CODE -- DO NOT EDIT!

'use strict';
var grpc = require('@grpc/grpc-js');
var auth_pb = require('./auth_pb.js');

function serialize_auth_ValidateTokenRequest(arg) {
  if (!(arg instanceof auth_pb.ValidateTokenRequest)) {
    throw new Error('Expected argument of type auth.ValidateTokenRequest');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_ValidateTokenRequest(buffer_arg) {
  return auth_pb.ValidateTokenRequest.deserializeBinary(new Uint8Array(buffer_arg));
}

function serialize_auth_ValidateTokenResponse(arg) {
  if (!(arg instanceof auth_pb.ValidateTokenResponse)) {
    throw new Error('Expected argument of type auth.ValidateTokenResponse');
  }
  return Buffer.from(arg.serializeBinary());
}

function deserialize_auth_ValidateTokenResponse(buffer_arg) {
  return auth_pb.ValidateTokenResponse.deserializeBinary(new Uint8Array(buffer_arg));
}


var AuthServiceService = exports.AuthServiceService = {
  validateToken: {
    path: '/auth.AuthService/ValidateToken',
    requestStream: false,
    responseStream: false,
    requestType: auth_pb.ValidateTokenRequest,
    responseType: auth_pb.ValidateTokenResponse,
    requestSerialize: serialize_auth_ValidateTokenRequest,
    requestDeserialize: deserialize_auth_ValidateTokenRequest,
    responseSerialize: serialize_auth_ValidateTokenResponse,
    responseDeserialize: deserialize_auth_ValidateTokenResponse,
  },
};

exports.AuthServiceClient = grpc.makeGenericClientConstructor(AuthServiceService, 'AuthService');
