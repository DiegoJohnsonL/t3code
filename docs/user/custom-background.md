# Custom background

In web or desktop, open **Settings → Appearance → Custom background**. Turn on the switch,
then select **Customize background**, or run **Customize background** from the command palette.
The controller opens over your current chat, or returns you to your last chat from Settings.
If there is no previous chat, the app opens a draft for your most recently used project.
With no projects yet, you can configure the background behind the add-project screen.

Your current background configuration stays selected. Adjust it directly in the app, drag
the controller by its header, or minimize it to see more of your chat. It stays open as you
switch chats. Opening Settings, Usage, or Pull requests closes it. Opening the theme editor
closes the background controller, and vice versa.
Changes save automatically; **Done** or close keeps them. **Enable custom background** in the
controller and the switch in Settings control the same preference. Turning either off hides the
background everywhere without deleting your selection or library. The controller stays open
so you can turn it back on. Select **None** in the controller to deselect the background.

## Backgrounds

A background is a picture (or nothing, for gradients), a filter, and a fade. Create one with
the **+** button. New backgrounds start without an image or filter. Choose an image
(JPEG, PNG, WebP, or HEIC) or a gradient filter, then edit the name. Delete backgrounds
from the background picker; deleting one never deletes its image.

## Filters

Filters are shaders from Paper. Their controls match the ones in Paper's playgrounds.
Every filter renders a single still frame; Grain gradient exposes a **Variation** slider
to pick the frame instead of animating.

- Image filters: Dithering, Fluted glass, Lens distortion. Choose **No filter**
  to show the picture as is. Dithering starts from a **Look** preset. **Original** keeps the
  picture's colors, **Faded** does too and also sets the fade sliders so the bottom melts
  into your theme color, while **Violet**, **Terminal**, and **Mono** repaint it in a
  tinted palette. Every slider stays editable after picking one.
- Gradient filters: Mesh gradient and Grain gradient paint the whole picture themselves and
  ignore the image.

Filters need WebGL. In a browser without it the controller says so and turns the filter
selector off. A picture still shows without a filter; gradient-only backgrounds draw nothing.

## Fade

Three sliders blend your theme's background color over the picture. **Bottom fade** is
the strength at the bottom edge where the composer sits; 100% goes solid. **Top dim** is
the strength above the fade, so lower it to see more of the picture. **Fade height** is how
far up the fade climbs before it settles at the dim level. For a picture that melts into
black at the bottom, keep bottom fade at 100% and raise fade height.

## Images

Images are resized, converted to WebP, and stored on this client only. Uploading the same
file twice reuses the stored copy. The image picker lists every stored image, lets you
upload another, and deletes the ones no background uses.

Select more than one image to rotate through them. The order you pick them is the order
they play, and **Change every** sets how long each stays up. Rotation follows the clock,
so every window and reload shows the same image at the same time. Images stay on this client when you
connect to remote environments; other browsers, devices, and T3 Code Mobile keep their own
appearance.

## New chats and conversations

While custom backgrounds are enabled, the selected background appears on new chats.
**Show in threads**, inside the controller, decides whether it stays after you submit
your first prompt. When off, the background disappears as soon as you submit. Changes
take effect immediately, including while the controller is open. Both switches keep their
values after a refresh.

**Restore defaults** deselects the background and turns both switches back on, but keeps your
library.
