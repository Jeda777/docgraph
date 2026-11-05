/** Content id the templates reference the logo by (`<img src="cid:...">`). */
export const LOGO_CID = 'docgraph-logo'

/**
 * `apps/web/public/logo.svg` as a 90×120 PNG (Gmail and Outlook don't show SVG), inlined so the
 * bundled server needs no asset files. Regenerate with sharp after changing the logo:
 *
 * ```js
 * const svg = fs.readFileSync('apps/web/public/logo.svg')
 * const page = await sharp(svg, { density: 154 }).png().toBuffer()
 * const png = await sharp(page).trim({ threshold: 0 }).resize(90, 120, { fit: 'fill' })
 *   .png({ compressionLevel: 9, palette: true }).toBuffer()
 * console.log(png.toString('base64'))
 * ```
 */
const LOGO_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAFoAAAB4CAMAAABFEhUNAAADAFBMVEVMaXEAlGQwxo4xxpBM3KEAAABM26EAlmkAl2QAlmcAglhM26AAkF8AlmcAlWYAl2gyxo8zx5AAlWgAl2gAlGUAq1Uzxo9M3aEAlmgAkmMAmGQAlmUAl2gAkGQAl2cAdU4AlGUAl2gFi1souYYAk14rv4kAlmcAlmcAlWcAlmgAlWgyw45M3KESrXZN3KEAlmQZrXkAmGYAmWUAlWYdr3wAlGYAmGnt/fVL26ACmWoAmGkAmWrq/PPr/PT///8BmGoAlGYAmWns/fUAlmYDmmtM3KFK2qABmWsAlmdN3aIAlWcAlWXo+/IAkmEWrHlD1Jrp+/MDmWsBl2gkuIRJ2Z7s/PTs/fQAl2j8//73//sAl2fz//jp/PPn+/H1//oAk2L6//3x//jt/PUDmGn4//wAkV/u/vYAmGj5//wAlGT9///m+vEFmmzz/vnw/vcDmWoAlGPq+/Pr/PRzyq4AlWQInW4Fl2jn+/Lv/vZwyKzv/PZJ5aYAk2Mkp37g+O4CmmoDmmxoxad1y7Dk+fDp+/K86NhYvp0Ajlu15tTT8+YAkF1I46UXonc4sIuS18AoqYERn3Pz//kWoXUGm20Zo3gipnw1r4ltx6oepXuQ1b47soz+///p+vKo38xhwaNAtI9GtpIIm20Mm24sq4QAj13u/fWz5NMxxI3B69tOupfl+vEAkWABkmBJ5KVJ46ZdwKApqoLF7N6N1L0NnnHD69zP8OOa2sWf3Mar4c4cpHmAz7aK07t+zrR6zbKh3cgSoXTJ7uB4y7BP3qNO3qI/0ZhG4aMwrYXo/PMLnXBXvpxIt5RRu5ny/fgRqHWE0be+6dkElGTN8OPY9OmV2MELmmvc9usRnXBrxqjS8eU8z5ZG150mu4YMo3Lf9ey45tak3sqN1LyF0bc4y5MElmYGlmWu4tBLuZbn+fIAjFY9s41lwqXr/fOX2cPr+/Tp/PIgtYCw5NFQ4KRhvp8ImWpKuJVLuJVLt5UyrITi9u4yrIWJz7YAhE7q+/QAiFSDzLMuwYv+9XEiAAAANnRSTlMAQF5h+QH3d1GXAvgRcSSjZGfT+C8Eav3aSzRj4lG3DV3qGlUJ/YP2scuua/oc/jifYVOTrv3pfZiZAAAACXBIWXMAABevAAAXrwGQoAIMAAAIPElEQVRo3u3ad3gT5xkAcCCGtiGkbUZpkqZtmtG9+5x0j8531SA6OCmR1Eo6CVsDW9YJCdk+b8czHmBj42289wI7AQzFzDBCeAiYYZYhezskgaQ7nU/vbMfxndZJd/6nT94/sZ+f3+f9vvu+9/v4Fi2aje8s/u6KL4URK37580cWcYjbF3/7bqkUCCMka84OPvqL74WU7/gBoAPCC8maJ5782cq3Hg4h3/lNKQBEQK9+PGrzN4LnfBcAREiLo575cbA6f1UaOS1evvnrgel7nAAPWhz1bOCaRJT057R42TOB8r73IYAfLV72VIC875TypQPWezF/Wrz8Kb/2gwB/mqr3bX7oLwtBU/bXli4Q7dcWiBYv97WFoin7tqULRIuXPcvKWziaspl5C0jTc3DpAtHUd7lk6QLRlD0vb2FpRt6R0ujZE8/7oamxnLMjpY2vXD/ujxZHzdUkQhqQAm/90S8tjnphCT86P+flVWL/EbV5CS9agr5ywn9F5vKOlAbyXS+vCpj3Cw/zoQFJ/uDxQPZPrv+UDy01pg2uft4//fjK3/ChAamz4NGXVh9fvcpPrBy8gw8NSKSus4Mnnnzp937i+q940RSuy0l74uPf+YmPH+NJA0i+c81v/cav+dJ05hLQT0i+IgAdIP7vaGS6ZIjwNCiVJ1nVOZgTlAhMS63q3bm9J3fWvz1sBoWkEfRCbmlzyUTZnvasyh6rUkAa694xBBM13ky7CZ46l+tCBKPluw8S4+5iCCKhGLce3tUoTxSIlvdsgbcny0QzQbpt1xpzFILQ5rhCW5Fe9Hm4iddqMVAIOnVnnsYgmh+k/ZBaIQBt9qTgGQxZFIOXNMhB/nRqxS4RyaQN/ds7yj28aSQn16QSsUIDH+yr4581VgnHsuli+NKwxxPHl0a7cJ+sIdumBqsDVbDHUqJVUKFFuNa6EnazaUNm0SdZnUdGho3zdalWZ3X09ZWrUUVixLUWiRIIOO+5yZar5WqnIn/mN5U6x597T79Yuq3liMOljXCGUCHTZPTjeNmlDxovlyeBnkTAWWDtee+NobwNNW0TYx/sV+sQDvO6IAVnjyMJ0VUpjrG3EhPNO3a+05eUWKeuGp2CLV7qR3bcNPDeBZ2Ey9dYRDLTNnjX3lLRH+iHqphxOLvk3ItV77z/9xLcGwvpZQYSUt3CX+14G0VCryFIYbx7/hqSbL9yDcYzVdMr1k2VwQSvKzlQOmTTRH/2G/q2bP02ozEkjWA9H+Exc8uILBq/tq3zcPunMCFqo3X9v6cMRKvNS8rmz/zMi7lY6EUVMe9utptuqZLp1GUiy64b6pHy6m0HPmmDLYa2aFpP1kB65nC417/ZjYbeChDscuF5U6upn6btA7nqAo8CLVc3lY4OjcM1kOom9c8y9hyKdTelctjAQHQ4t3DL+e1UzqTtn/9Jo/+cR4v1pfd2XDpqgu2qaN+Zr8JZ1Q6wo0sUSX1xje0WSATB7cbEmbEHC0Br3+XKybGLuMXgQ0OWQ3Uopz5E60FdhdQnTxLn563V+QXUt321c3LI62NDa/eeknPsnhKtp2m6pqzLOn9ZUijM1ve3ivrZNmQf40yD6n/kyUhDJjTJ3gbS1KV5dj2brhlN40pLXE0DNVSx8eY+Fq21dv7Bwl5nNPGFWjPXdpJqR2zFomR4nwdgfsMgcGoA1rDoDNtJjHsTjHXQxY7f04ux1sy6jcfsIubMJhNeq+ZOg8OdhEpG1lw8w2oVlHHoKJsuwk+bndxpdW9ZJrVS2I9tZOy5Sl3cMQ1rGIvg5h4591OBxFW/z6Khiv2Rw8OUU7Kp8RXpoQ9nF75kN7yvFg3nwIF2H1ivoqbIQLURZOScvYGSSYMlOzZDo1G5YyzxWyrkYZ1lkJxSehxNRxuTtIycaRnyxm66ArcSBA6PD+xIw5CwaK2jxQ4Z9Pa80rmKzMgxlLwuYWt9Y+HBsde3pPytyeorB6dBa9VRO0lNv0OfjSMlZ62blbPSrY6ktIr6atSRhCBhHu4kWO1z8RqqLRubLQid86zcn5Iup5obM4bJddrE8M+NxsRjcAbdO9WjIDPn/qfTp9dDSeDjX3AaHDlDj6Nl4oZVy6wGlbOS12lX66icMuj13qIO9SmElm/OyJlPp2NKfgdpMKfq/Fpq8Wv9778uxAFxWdNzI1pEV0PJ94xuPtKMq9ZR20HzZJN5phrRogROcgha6bq6lyim2qcNRNGegU8tYeQc6pNx7W8vml7h9Hp7PNXUUF83lbOOkxyUViY1lKyd3V9lMj1JrXVkf8JhbjmH2MBq2wlmk0R6RSk6TMn/qgXtsKkY673MkHCYsxyEBq25R2timP07ZPrTxjr+tziI9S8+hxoV/AYAILxptPvcevahJjm+pCpJy5dGqFXPwm4ISPu1G2retMS1fxO9ATLpzLy/OhS8s06tf9fiQ3uvdAlAY9V7TRqfvm6ikn9BAKN0K5zB7uuIffs5X7oEmdcjLSb2+TEDPsQ56SC0JLX2ddYUIe1lnSMKIS4+rV3eWMaH7sbfTAUFua41O7fi7nlttLv13QpMGBqRdx8gNBr97Pl/Ct/UEM7FWfBdxpy441WCVBVrNLFQzfioT8fIZ29EzQ0pEwRhiseLLrV4zIJejRuxguqqrtIzJyvSULnQt+5mTO4EnHIMBYCFuNA3Gp1f/DeEAPSDC0dH+GAmdDwW6TOf0LEi0sdJIUN6f6RPqkLGt26P9CFYqJCsiPj5WsikH4n40V2IuPv+yJ8KBg3d9++beyz4o7AfOAadHHfdw+dZZkBWqvvhA/cyHymF+5g0QDxw39wr0P8B/gO5d/nTiegAAAAASUVORK5CYII='

/**
 * The logo as a `data:` URL, for the react-email preview (`pnpm --filter server email:dev`), which
 * can't resolve `cid:` URLs. Not for sent emails: Gmail and Outlook block `data:` images.
 */
export const LOGO_DATA_URI = `data:image/png;base64,${LOGO_PNG_BASE64}`

/**
 * The logo sent as an inline attachment of every email. Not linked from the server, since its
 * `Cross-Origin-Resource-Policy: same-origin` stops email clients from loading our images (see
 * `src/lib/security.ts`), and remote images are often blocked by default anyway.
 */
export const LOGO_ATTACHMENT = {
  filename: 'logo.png',
  content: Buffer.from(LOGO_PNG_BASE64, 'base64'),
  contentType: 'image/png',
  cid: LOGO_CID,
}
