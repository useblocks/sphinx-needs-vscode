// https://github.com/golang/vscode-go/blob/master/src/goLogging.ts
'use strict';

export type LogLevel = 'off' | 'error' | 'warn' | 'info' | 'debug' | 'verbose';

const logLevels = {
	off: -1,
	error: 0,
	warn: 1,
	info: 2,
	debug: 3,
	verbose: 4
};

function levelToString(level: number) {
	switch (level) {
		case logLevels.error:
			return 'Error';
		case logLevels.warn:
			return 'Warn';
		case logLevels.info:
			return 'Info';
		case logLevels.debug:
			return 'Debug';
		case logLevels.verbose:
			return 'Verbose';
	}
	return '';
}

export class TimeStampedLogger {
	protected minLevel: number;

	constructor(levelName: LogLevel) {
		this.minLevel = logLevels[levelName] || logLevels.error;
	}

	protected log(msglevel: number, msg: string) {
		if (this.minLevel < 0) {
			return;
		}

		if (this.minLevel < msglevel) {
			return;
		}

		const ts = new Date().toLocaleTimeString();
		// output messages to console
		console.log(`[${levelToString(msglevel)} - ${ts}] ${msg}`);
	}

	error(msg: string) {
		this.log(logLevels.error, msg);
	}

	warn(msg: string) {
		this.log(logLevels.warn, msg);
	}

	info(msg: string) {
		this.log(logLevels.info, msg);
	}

	debug(msg: string) {
		this.log(logLevels.debug, msg);
	}

	verbose(msg: string) {
		this.log(logLevels.verbose, msg);
	}
}
