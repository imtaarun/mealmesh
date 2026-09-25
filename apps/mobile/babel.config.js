module.exports = function (api) {
  api.cache(true);
  return {
    // babel-preset-expo auto-adds react-native-reanimated/plugin when the package is
    // installed, so it's deliberately absent from `plugins` here — adding it again
    // would just register it twice.
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
