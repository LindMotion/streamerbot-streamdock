'use strict';

const { renderButton, toDataUrl } = require('../render/png');

function appearanceFrom(settings) {
  return {
    title: settings?.buttonTitle || settings?.title || '',
    background: settings?.background || '',
    customPng: settings?.customPng || '',
    fontSize: Number(settings?.fontSize || 0)
  };
}

function applyAppearance(sd, context, settings, fallback) {
  const look = appearanceFrom(settings);
  if (look.customPng && look.customPng.startsWith('data:image/')) {
    sd.setImage(context, look.customPng);
    if (look.title) sd.setTitle(context, look.title);
    return 'custom';
  }
  const title = look.title || fallback?.title || '';
  const background = look.background || fallback?.background || '#2a2a32';
  const scale = look.fontSize >= 18 ? 4 : look.fontSize >= 12 ? 3 : look.fontSize > 0 ? 2 : fallback?.scale || 3;
  const png = renderButton({
    background,
    accent: fallback?.accent || null,
    title,
    subtitle: fallback?.subtitle || '',
    titleColor: fallback?.titleColor || '#ffffff',
    scale
  });
  sd.setImage(context, toDataUrl(png));
  return 'rendered';
}

module.exports = { appearanceFrom, applyAppearance };
