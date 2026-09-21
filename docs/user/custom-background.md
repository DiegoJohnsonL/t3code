# Custom background

In web or desktop, open **Settings → Appearance → Custom background**. Turn on the switch,
then select **Customize background**, or run **Customize background** from the command palette.
The picture button at the bottom of the sidebar has it too. The controls take over the
sidebar, and **Back** at the bottom returns you to your threads. Opening it from Settings
returns you to your last chat first. If there is no previous chat, the app opens a draft
for your most recently used project. With no projects yet, you can configure the background
behind the add-project screen.

Your current background configuration stays selected. Adjust it and watch your chat change
behind the sidebar. The panel stays open as you switch chats. Opening Settings, Usage, or
Pull requests closes it. Opening the theme editor closes the background panel, and vice
versa. Changes save automatically. **Enable custom background** in the panel and the switch
in Settings control the same preference. Turning either off hides the background everywhere
without deleting your selection or library. The panel stays open so you can turn it back
on. Select **None** to deselect the background.

## Backgrounds

A playlist is one or more pictures, a filter, and a fade. Create one with **New playlist**.
New playlists start without an image or filter. Choose images (JPEG, PNG, WebP,
or HEIC), then edit the name. Delete backgrounds from the background picker; deleting one
never deletes its images.

## Filters

Filters are shaders from Paper that repaint your picture. Their controls match the ones in
Paper's playgrounds, and every filter renders a single still frame.

- **Dithering**, or **No filter** to show the picture as is. Dithering starts from a **Look**
  preset. **Original** keeps the
  picture's colors, **Faded** does too and also sets the fade sliders so the bottom melts
  into your theme color, while **Violet**, **Terminal**, and **Mono** repaint it in a
  tinted palette. Every slider stays editable after picking one.

Filters need WebGL. In a browser without it the panel says so and turns the filter
selector off. The picture still shows, without its filter.

## Fade

**Image opacity** sets how much of the picture shows over your theme's background at all;
lower it when text needs more contrast. The other sliders blend your theme's background
color over the picture, so the tint always matches the theme you picked. **Bottom fade** is
the strength at the bottom edge; 100% goes solid. **Fade height** is how far up the pane
that fade reaches; the lower part of the stretch stays solid and the rest eases off.
**Dim** is the flat strength everywhere above the fade, so lower it to keep the top and
sides of the picture bright. For a picture that melts into your theme color halfway up,
keep bottom fade at 100% and raise fade height.

## Images

Images are resized, converted to WebP, and stored on this client only. Uploading the same
file twice reuses the stored copy. The image picker lists every stored image, lets you
upload another, and deletes the ones no background uses.

Select more than one image to rotate through them. **Change every** sets how long each
stays up. **Order** plays them as picked or shuffles them; shuffle shows every image once
before any repeats and never shows the same one twice in a row. **Transition** is a slow
crossfade or a plain cut. Rotation follows the clock, so every window and reload
shows the same image at the same time. The picture button at the bottom of the sidebar
steps to the next or previous image; the panel has the same **Next** and **Previous**
buttons for trying transitions out. Images stay on this client when you
connect to remote environments; other browsers, devices, and T3 Code Mobile keep their own
appearance.

## New chats and conversations

While custom backgrounds are enabled, the selected background appears on new chats and
stays there once you submit your first prompt. Changes take effect immediately, including
while the panel is open, and the switch keeps its value after a refresh.

**Restore defaults** deselects the background and turns the switch back on, but keeps your
library.
