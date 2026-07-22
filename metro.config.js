const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// pdf-lib imports helpers from tslib. Metro's package-exports resolution picks
// tslib's .mjs build, whose interop leaves `tslib.default` undefined on web
// ("Cannot destructure property '__extends' of 'tslib.default'"). Pin tslib to
// its named-exports ES build so the destructuring works on every platform.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "tslib") {
    return {
      type: "sourceFile",
      filePath: require.resolve("tslib/tslib.es6.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
