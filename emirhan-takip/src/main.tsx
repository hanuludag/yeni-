import { render } from 'preact';
import './styles.css';
import { App } from './app';
import { baslat } from './lib/store';
import { paraBaslat } from './lib/para/store';

baslat();
paraBaslat();
render(<App />, document.getElementById('app')!);
