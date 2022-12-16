.PHONY: init
init:
		npm install
		npm run compile

.PHONY: lint
lint:
		npm run lint

.PHONY: test
test:
		npm run test

.PHONY: release
release:
		vsce package

.PHONY: docs
docs-init:
		pip install -r docs/requirements.txt

docs:
		cd docs && make html
