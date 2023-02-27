'use strict';

import * as vscode from 'vscode';

interface HelpLink {
	id: string;
	link: string;
	icon: string;
}

interface HelpLinks {
	[uselink: string]: HelpLink;
}

interface LinkIcon {
	docs: string;
	code: string;
	newIssue: string;
	issues: string;
}

// https://code.visualstudio.com/api/references/icons-in-labels#icon-listing
const linkIcons: LinkIcon = {
	docs: 'book',
	code: 'github',
	newIssue: 'issue-draft',
	issues: 'issues'
};

const sphinxNeedsGithub = 'https://github.com/useblocks/sphinx-needs';
const sphinxNeedsVsCodeGithub = 'https://github.com/useblocks/sphinx-needs-vscode';

const needLinks: HelpLinks = {
	SNDocs: {
		id: 'Read Sphinx-Needs Official Docs',
		link: 'https://sphinx-needs.readthedocs.io/en/latest/index.html',
		icon: linkIcons.docs
	},
	SNCode: {
		id: 'Sphinx-Needs Source Code on Github',
		link: sphinxNeedsGithub,
		icon: linkIcons.code
	},
	SNNewIssue: {
		id: 'Open new issue for Sphinx-Needs',
		link: `${sphinxNeedsGithub}/issues/new`,
		icon: linkIcons.newIssue
	},
	SNIssues: {
		id: 'Review issues of Sphinx-Needs',
		link: `${sphinxNeedsGithub}/issues`,
		icon: linkIcons.issues
	},
	SNVDocs: {
		id: 'Read Sphinx-Needs-VsCode Official Docs',
		link: 'https://sphinx-needs-vscode.useblocks.com/',
		icon: linkIcons.docs
	},
	SNVCode: {
		id: 'Sphinx-Needs-VsCode Source Code on Github',
		link: sphinxNeedsVsCodeGithub,
		icon: linkIcons.code
	},
	SNVNewIssue: {
		id: 'Open new issue for Sphinx-Needs-VsCode',
		link: `${sphinxNeedsVsCodeGithub}/issues/new`,
		icon: linkIcons.newIssue
	},
	SNVIssues: {
		id: 'Review issues of Sphinx-Needs-VsCode',
		link: `${sphinxNeedsVsCodeGithub}/issues`,
		icon: linkIcons.issues
	}
};

export class NeedsHelpsProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
	getChildren(element?: NeedsHelpsItem): Thenable<NeedsHelpsItem[]> {
		if (!element) {
			const linkItems: NeedsHelpsItem[] = [];
			Object.values(needLinks).forEach((item) => {
				const linkItem = new NeedsHelpsItem(
					item.id,
					item.link,
					item.icon,
					vscode.TreeItemCollapsibleState.None
				);
				linkItem.command = {
					command: 'sphinxNeedsHelp.openUrl',
					title: 'Open Url',
					arguments: [item.link]
				};
				linkItems.push(linkItem);
			});
			return Promise.resolve(linkItems);
		}
		return Promise.resolve([]);
	}

	getTreeItem(element: NeedsHelpsItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		return element;
	}
}

// Helpfuls links item
class NeedsHelpsItem extends vscode.TreeItem {
	constructor(
		public readonly id: string,
		private link: string,
		private icon: string,
		collapsibleState: vscode.TreeItemCollapsibleState
	) {
		super(id, collapsibleState);
		this.iconPath = new vscode.ThemeIcon(this.icon);
		this.resourceUri = vscode.Uri.parse(this.link);
		this.tooltip = new vscode.MarkdownString(this.id, true);
	}
}
