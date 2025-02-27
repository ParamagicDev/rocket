/* eslint-disable @typescript-eslint/ban-ts-comment */
import { html, LitElement, css, repeat } from '@lion/core';
import MiniSearch from 'minisearch';
import { ScopedElementsMixin } from '@open-wc/scoped-elements';
import { RocketSearchCombobox } from './RocketSearchCombobox.js';
import { RocketSearchOption } from './RocketSearchOption.js';
import { highlightSearchTerms, joinTitleHeadline } from './utils-shared.js';

/** @typedef {import('./types').RocketSearchResult} RocketSearchResult */

/**
 * @param {object} options
 * @param {RocketSearchResult} options.result
 * @param {string} options.search
 */
function getTitle({ result, search }) {
  const { terms, title, headline } = result;

  const header = joinTitleHeadline(title, headline);
  return highlightSearchTerms({ text: header, search, terms });
}

/**
 * @param {object} options
 * @param {RocketSearchResult} options.result
 * @param {string} options.search
 */
function getText({ result, search }) {
  const { terms, body } = result;

  return highlightSearchTerms({ text: body, search, terms, addEllipsis: true });
}

// @ts-expect-error https://github.com/microsoft/TypeScript/issues/40110
export class RocketSearch extends ScopedElementsMixin(LitElement) {
  static get properties() {
    return {
      jsonUrl: { type: String, attribute: 'json-url' },
      search: { type: String },
      results: { type: Array },
      maxResults: { type: Number, attribute: 'max-results' },
      noResultsText: { type: String },
    };
  }

  static get scopedElements() {
    return {
      'rocket-search-combobox': RocketSearchCombobox,
      'rocket-search-option': RocketSearchOption,
    };
  }

  constructor() {
    super();
    this.jsonUrl = '';
    this.search = '';
    this.maxResults = 10;
    this.noResultsText = 'No results found';
    /**
     * @type {RocketSearchResult[]}
     */
    this.results = [];
    this.miniSearch = null;
  }

  async setupSearch() {
    if (!this.jsonUrl) {
      throw new Error(
        'You need to provide a URL to your JSON index. For example: <rocket-search json-url="https://.../search-index.json"></rocket-search>',
      );
    }

    let responseText;
    try {
      const response = await fetch(this.jsonUrl);
      responseText = await response.text();
    } catch (e) {
      throw new Error(`The given json-url "${this.jsonUrl}" could not be fetched.`);
    }

    if (responseText[0] !== '{') {
      throw new Error(`The given json-url "${this.jsonUrl}" could not be fetched.`);
    }

    this.miniSearch = MiniSearch.loadJSON(responseText, {
      fields: ['title', 'headline', 'body'],
      searchOptions: {
        boost: { headline: 3, title: 2 },
        fuzzy: 0.2,
        prefix: true,
      },
    });
  }

  get combobox() {
    return this.shadowRoot.querySelector('rocket-search-combobox');
  }

  /** @param {import('lit-element').PropertyValues } changedProperties */
  update(changedProperties) {
    if (this.miniSearch && changedProperties.has('search')) {
      this.results = /** @type {RocketSearchResult[]} */ (this.miniSearch.search(
        this.search,
      )).slice(0, this.maxResults);
    }

    super.update(changedProperties);
  }

  render() {
    return html`
      <rocket-search-combobox
        name="combo"
        label="Search"
        @input=${ev => {
          this.search = ev.target.value;
        }}
        @focus=${() => {
          this.setupSearch();
        }}
      >
        ${repeat(
          this.results,
          result => result.id,
          result => html`
            <rocket-search-option
              href=${result.id}
              rel="noopener noreferrer"
              .title=${getTitle({ result, search: this.search })}
              .choiceValue=${this.search}
              .text=${getText({ result, search: this.search })}
              .section=${result.section ? result.section : 'others'}
            ></rocket-search-option>
          `,
        )}
        ${this.results.length <= 0 && this.search.length > 0
          ? html` <rocket-search-option .title=${this.noResultsText}></rocket-search-option> `
          : ''}
      </rocket-search-combobox>
    `;
  }

  static get styles() {
    return css`
      :host {
        display: block;
      }

      ::slotted(input.form-control) {
        caret-color: var(--rocket-search-caret-color, initial);
      }
    `;
  }
}
