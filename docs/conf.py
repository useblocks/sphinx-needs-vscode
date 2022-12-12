# -- Project information -----------------------------------------------------

project = "Sphinx Need Vscode"
copyright = "useblocks GmbH"
author = "useblocks teams"

# -- General configuration ---------------------------------------------------

# Add any Sphinx extension module names here, as strings. They can be
# extensions coming with Sphinx (named 'sphinx.ext.*') or your custom
# ones.
extensions = [
	"sphinx_needs",
	"sphinx_immaterial",
]

needs_types = [
	{"directive": "req", "title": "Requirement", "prefix": "R_", "color": "#BFD8D2", "style": "node"},
	{"directive": "spec", "title": "Specification", "prefix": "S_", "color": "#FEDCD2", "style": "node"},
	{"directive": "impl", "title": "Implementation", "prefix": "I_", "color": "#DF744A", "style": "node"},
	{"directive": "test", "title": "Test Case", "prefix": "T_", "color": "#DCB239", "style": "node"},
	# Kept for backwards compatibility
	{"directive": "need", "title": "Need", "prefix": "N_", "color": "#9856a5", "style": "node"},
]

# build needs.json to make permalinks work
needs_build_json = True

# Add any paths that contain templates here, relative to this directory.
templates_path = ["_templates"]

# List of patterns, relative to source directory, that match files and
# directories to ignore when looking for source files.
# This pattern also affects html_static_path and html_extra_path.
exclude_patterns = ["_build", "Thumbs.db", ".DS_Store"]

# -- Options for HTML output -------------------------------------------------

# The theme to use for HTML and HTML Help pages.  See the documentation for
# a list of builtin themes.
html_logo = "./_images/sn-logo.png"
html_favicon = "./_images/sn-favicon.png"
html_theme = "sphinx_immaterial"
html_title = "Sphinx Needs Vscode"
html_theme_options = {
	"icon": {
		"repo": "fontawesome/brands/github",
	},
	"font": {
		"code": "JetBrains Mono",
		"text": "Urbanist"
	},
	"site_url": "https://sphinx-needs-vscode.useblocks.com/",
	"repo_url": "https://github.com/useblocks/sphinx-needs-vscode",
	"repo_name": "Sphinx-Need-Vscode",
	"repo_type": "github",
	"edit_uri": "blob/main/docs",
	"globaltoc_collapse": True,
	"features": [
		# "navigation.sections",
		"navigation.top",
		"search.share",
		"navigation.tracking",
		"toc.follow",
		"content.tabs.link"
	],
	"palette": {
		"scheme": "slate",
		"primary": "yellow",
		"accent": "yellow",
	},
	"toc_title_is_page_title": True,
	"toc_title": "Contents",
}

sphinx_immaterial_external_resource_cache_dir =  "./.cache/external_resources"

# Add any paths that contain custom static files (such as style sheets) here,
# relative to this directory. They are copied after the builtin static files,
# so a file named "default.css" will overwrite the builtin "default.css".
html_static_path = ["_static"]
html_css_files = ['custom.css']
html_js_files = ['custom.js']
