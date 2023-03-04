export default {
  mqtt: {
    onMessage: 'onMessage',
  },
  user: {
    signUp: 'onUserSignUp',
    signIn: 'onUserSignIn',
  },
  node: {
    onConnect: 'onNodeConnect',
    onDisconnect: 'onNodedisconnect',
    onUpdateRegistry: 'onUpdateRegistry',
  },
  system: {
    onUpdateState: 'onUpdateState',
  },
};
