(() => {
    "use strict";

    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

    const selectors = {
        left: ".noise_01",
        center: ".noise_03",
        right: ".noise_02"
    };

    const channelState = new Map();
    const audioGains = new Map();

    function setupSliders(panel) {
        panel.querySelectorAll(".slider input").forEach((input) => {
            const slider = input.closest(".slider");
            const output = slider.querySelector("output");

            function update() {
                const min = Number(input.min);
                const max = Number(input.max);
                const value = Number(input.value);

                const progress = max > min
                    ? clamp((value - min) / (max - min), 0, 1)
                    : 0;

                input.style.removeProperty("--fill");

                slider.style.setProperty(
                    "--fill",
                    `calc(0.5vw + (100% - 1vw) * ${progress})`
                );

                output.textContent = input.dataset.unit === "%"
                    ? `${Number.isInteger(value) ? value : value.toFixed(1)} %`
                    : `${value.toFixed(2)} s`;
            }

            input.addEventListener("input", update);
            update();
        });
    }

    function setupWaveButtons(panel) {
        const buttons = [...panel.querySelectorAll("[data-wave]")];

        buttons.forEach((button) => {
            button.addEventListener("click", () => {
                buttons.forEach((item) => {
                    const active = item === button;

                    item.classList.toggle("active", active);
                    item.setAttribute("aria-pressed", String(active));
                });
            });
        });
    }

    function setupDials(panel) {
        panel.querySelectorAll(".effect input").forEach((input) => {
            const dial = input.closest(".dial");
            const output = input.closest(".effect").querySelector("output");

            let drag = null;

            function update() {
                const min = Number(input.min);
                const max = Number(input.max);

                const progress = max > min
                    ? clamp((Number(input.value) - min) / (max - min), 0, 1)
                    : 0;

                dial.style.setProperty(
                    "--arc",
                    `${progress * 270}deg`
                );

                dial.style.setProperty(
                    "--angle",
                    `${progress * 270 - 135}deg`
                );

                output.textContent = Number(input.value).toFixed(2);
                input.setAttribute("aria-valuetext", output.textContent);
            }

            input.addEventListener("pointerdown", (event) => {
                if (input.disabled || event.button !== 0) return;

                event.preventDefault();
                input.focus();
                input.setPointerCapture(event.pointerId);

                drag = {
                    id: event.pointerId,
                    x: event.clientX,
                    y: event.clientY,
                    value: Number(input.value)
                };
            });

            input.addEventListener("pointermove", (event) => {
                if (!drag || event.pointerId !== drag.id || input.disabled) {
                    return;
                }

                const min = Number(input.min);
                const max = Number(input.max);
                const step = Number(input.step) || (max - min) / 100;

                const distance =
                    event.clientX - drag.x + drag.y - event.clientY;

                const initialStep = Math.round((drag.value - min) / step);
                const stepsMoved = Math.round(distance / 14);

                const value = clamp(
                    min + (initialStep + stepsMoved) * step,
                    min,
                    max
                );

                if (Number(input.value) === value) return;

                input.value = String(Number(value.toFixed(5)));

                input.dispatchEvent(
                    new Event("input", { bubbles: true })
                );
            });

            function finishDrag() {
                drag = null;
            }

            input.addEventListener("pointerup", finishDrag);
            input.addEventListener("pointercancel", finishDrag);
            input.addEventListener("lostpointercapture", finishDrag);
            input.addEventListener("input", update);

            update();
        });
    }

    function setupPanel(panel) {
        setupSliders(panel);
        setupWaveButtons(panel);
        setupDials(panel);
    }

    function updateChannelAudio(channel) {
        const entry = audioGains.get(channel);
        if (!entry) return;

        const { node, enabledLevel } = entry;

        const target = channelState.get(channel)
            ? enabledLevel
            : 0;

        const now = node.context.currentTime;

        node.gain.cancelScheduledValues(now);
        node.gain.setTargetAtTime(target, now, 0.015);
    }

    function setEnabled(channel, enabled, notify = true) {
        if (!Object.hasOwn(selectors, channel)) return;

        const button = document.querySelector(
            `.channel_button[data-channel="${channel}"]`
        );

        const panel = document.querySelector(selectors[channel]);

        if (!button || !panel) return;

        const isEnabled = Boolean(enabled);

        channelState.set(channel, isEnabled);

        button.classList.toggle("active", isEnabled);
        button.setAttribute("aria-pressed", String(isEnabled));

        panel.dataset.enabled = String(isEnabled);

        panel.querySelectorAll("input, button, select").forEach((control) => {
            control.disabled = !isEnabled;
        });

        updateChannelAudio(channel);

        if (notify) {
            document.dispatchEvent(
                new CustomEvent("sound:channelchange", {
                    detail: {
                        channel,
                        enabled: isEnabled
                    }
                })
            );
        }
    }

    function setupChannels() {
        document.querySelectorAll(
            ".channel_button[data-channel]"
        ).forEach((button) => {
            const channel = button.dataset.channel;

            if (!Object.hasOwn(selectors, channel)) return;

            setEnabled(
                channel,
                button.getAttribute("aria-pressed") === "true",
                false
            );

            button.addEventListener("click", () => {
                setEnabled(channel, !channelState.get(channel));
            });
        });
    }

    window.soundChannels = {
        isEnabled(channel) {
            return channelState.get(channel) === true;
        },

        setEnabled(channel, enabled) {
            setEnabled(channel, enabled);
        },

        registerGain(channel, node, enabledLevel = 1) {
            if (!Object.hasOwn(selectors, channel) || !node?.gain) {
                return;
            }

            audioGains.set(channel, {
                node,
                enabledLevel
            });

            updateChannelAudio(channel);
        }
    };

    function init() {
        document.querySelectorAll(
            ".noise_01, .noise_02, .noise_03"
        ).forEach(setupPanel);

        setupChannels();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init, {
            once: true
        });
    } else {
        init();
    }
})();