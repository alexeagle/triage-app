load("@aspect_rules_ts//ts:defs.bzl", "ts_project")

package(default_visibility = ["//visibility:public"])

ts_project(
    name = "sync",
    srcs = ["issues.ts"],
    declaration = True,
    declaration_map = True,
    out_dir = "dist",
    resolve_json_module = True,
    root_dir = "src",
    source_map = True,
    tsconfig = "//:tsconfig",
    deps = [
        "//src/db",
        "//src/github",
    ],
)
