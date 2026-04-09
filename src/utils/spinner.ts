import ora, { type Ora } from 'ora';

export class Spinner {
  private spinner: Ora;

  constructor(text: string) {
    this.spinner = ora({ text, color: 'cyan' });
  }

  start(text?: string) {
    if (text) this.spinner.text = text;
    this.spinner.start();
    return this;
  }

  update(text: string) {
    this.spinner.text = text;
    return this;
  }

  succeed(text?: string) {
    this.spinner.succeed(text);
    return this;
  }

  fail(text?: string) {
    this.spinner.fail(text);
    return this;
  }

  stop() {
    this.spinner.stop();
    return this;
  }
}
