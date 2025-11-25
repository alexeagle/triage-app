load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

ts_project(
    name = "src",
    srcs = ["index.ts"],
    declaration = True,
    declaration_map = True,
    out_dir = "dist",
    resolve_json_module = True,
    root_dir = "src",
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = ["//src/sync"],
)
