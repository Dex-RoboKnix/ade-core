/*
 * Agent Desktop Environment (ADE)
 * Copyright (C) 2026  DexRoboKnix
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { BRAND_SHELL_NAME, t } from '@dexroboknix/shared';
import { render } from 'solid-js/web';
import './styles.css';

function App() {
  return (
    <div style={{ padding: '2rem', 'font-family': 'sans-serif' }}>
      <h1>{BRAND_SHELL_NAME}</h1>
      <p>{t('shell.statusLine')}</p>
    </div>
  );
}

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
}
