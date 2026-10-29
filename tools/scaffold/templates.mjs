// Each template receives the component naming variants and returns file contents.
// File paths follow Drupal conventions (templates/, css/, js/) so the generated
// module works as soon as it is enabled.

export function namingVariants(machineName) {
  const words = machineName.split('_').filter(Boolean);
  return {
    machineName,
    label: words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' '),
    cssClass: words.join('-'),
    jsName: words.map((w, i) => (i === 0 ? w : w[0].toUpperCase() + w.slice(1))).join(''),
  };
}

const infoYml = ({ machineName, label }) => `name: '${label}'
type: module
description: 'Componente visual ${machineName}.'
package: 'Custom components'
core_version_requirement: ^10.3 || ^11
`;

const librariesYml = ({ machineName }) => `${machineName}:
  version: 1.x
  css:
    component:
      css/${machineName}.css: {}
  js:
    js/${machineName}.js: {}
  dependencies:
    - core/drupal
    - core/once
`;

const moduleFile = ({ machineName }) => `<?php

/**
 * @file
 * Registers the ${machineName} component.
 */

declare(strict_types=1);

/**
 * Implements hook_theme().
 */
function ${machineName}_theme(): array {
  return [
    '${machineName}' => [
      'variables' => [
        'title' => NULL,
        'content' => NULL,
      ],
      'template' => '${machineName}',
    ],
  ];
}
`;

const twigTemplate = ({ machineName, cssClass }) => `{#
/**
 * @file
 * Template for the ${machineName} component.
 *
 * Available variables:
 * - title: Component heading.
 * - content: Component body (render array or markup).
 * - attributes: HTML attributes for the wrapper element.
 */
#}
{{ attach_library('${machineName}/${machineName}') }}
<div{{ attributes.addClass('${cssClass}') }}>
  {% if title %}
    <h2 class="${cssClass}__title">{{ title }}</h2>
  {% endif %}
  {% if content %}
    <div class="${cssClass}__content">{{ content }}</div>
  {% endif %}
</div>
`;

const cssFile = ({ cssClass }) => `.${cssClass} {
  display: block;
}

.${cssClass}__title {
  margin-block-end: 0.5em;
}
`;

const jsFile = ({ cssClass, jsName }) => `/**
 * @file
 * Behaviors for the ${cssClass} component.
 */
((Drupal, once) => {
  Drupal.behaviors.${jsName} = {
    attach(context) {
      once('${cssClass}', '.${cssClass}', context).forEach((element) => {
        element.classList.add('${cssClass}--ready');
      });
    },
  };
})(Drupal, once);
`;

/**
 * Returns the list of files to generate, relative to the component folder.
 */
export function buildFiles(machineName) {
  const vars = namingVariants(machineName);
  return [
    { path: `${machineName}.info.yml`, content: infoYml(vars) },
    { path: `${machineName}.libraries.yml`, content: librariesYml(vars) },
    { path: `${machineName}.module`, content: moduleFile(vars) },
    { path: `templates/${machineName}.html.twig`, content: twigTemplate(vars) },
    { path: `css/${machineName}.css`, content: cssFile(vars) },
    { path: `js/${machineName}.js`, content: jsFile(vars) },
  ];
}
