# Venue checklist

For a night with throw: one laptop, one or more projectors, optional Art-Net lights.

## Before the day

- [ ] Ask for the rider: projector models and throw ratios, where they hang, screen or wall
      sizes, the lighting desk and how DMX reaches the fixtures (Art-Net node IP and universe).
- [ ] Throw distance: in the tools tab, check the image size each projector gives from where it
      hangs, or how far back it must go for the size you need.
- [ ] Build the show at home in the previs and export it (show tab).
- [ ] Copy the show file, media files and a logo PNG to a USB stick as well.
- [ ] Laptop: charger, video adapters for every output (HDMI, DisplayPort, USB-C), a spare HDMI
      cable, a 3.5 mm or USB audio interface for the mixer feed, an Ethernet cable for Art-Net.
- [ ] Turn off sleep, screen lock, notifications and automatic updates.

## Load-in

- [ ] Connect projectors one by one; set each to its native resolution in the OS display settings.
- [ ] `pnpm start` (or `throw --artnet <node ip>`). Open one output window per projector, move it
      to that screen, press F.
- [ ] Test card on. Pin every surface's corners on the wall (outputs tab, or drag on the wall).
      Arrows nudge 1 px, Shift 10 px.
- [ ] Focus and keystone on the projector itself first; use throw's corners for the rest.
- [ ] Lights: confirm the node IP and universe with the lighting tech. Patch, then watch the DMX
      monitor before the fixtures go live. Agree who owns which fixtures.
- [ ] Phone remote: open the network address the terminal printed (not localhost), scan the QR,
      then hide the code.

## Line-check

- [ ] Ask the sound engineer for a feed from a spare aux or the record-out, at line level.
- [ ] Audio tab: the meters move with the music, onsets land on the kick, BPM is right. If not,
      tap tempo and press Enter on a downbeat.
- [ ] Strobe cap set for this room (3 Hz unless the venue posts a strobe warning).
- [ ] Panic (Esc) once with the lighting tech watching: video black, every channel at zero.

## Show

- [ ] Export the show after the line-check.
- [ ] Keep the operator tab in front; do not open other heavy tabs.
- [ ] Blackout (B) between acts and during announcements.

## After

- [ ] Export the show again. Film a minute of the room for your own records, if the venue agrees.
