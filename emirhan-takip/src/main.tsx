import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { baslat } from './lib/store';

baslat();
render(<App />, document.getElementById('app')!);
