/**
 * @jest-environment jsdom
 */
import { MotionPreference } from "@/core/playback/MotionPreference";
import { installFakeMatchMedia } from "@test/support/fakeDom";

describe("MotionPreference (AC-7)", () => {
  let media: ReturnType<typeof installFakeMatchMedia>;
  const make = (
    setting: "auto" | "always" | "never",
    system = false,
    legacy = false,
  ) => {
    media = installFakeMatchMedia({ matches: system, legacy });
    const onChange = jest.fn();
    return { motion: new MotionPreference(setting, onChange), onChange };
  };

  afterEach(() => media?.restore());

  it.each([
    ["always", false, true],
    ["never", true, false],
    ["auto", true, true],
    ["auto", false, false],
  ] as const)("%s with system %s gives %s", (setting, system, expected) => {
    expect(make(setting, system).motion.reduced).toBe(expected);
  });

  it("counts as not reduced without matchMedia", () => {
    const motion = new MotionPreference("auto", jest.fn(), undefined);
    expect(motion.reduced).toBe(false);
    expect(() => motion.dispose()).not.toThrow();
  });

  it("tells its owner only when the answer flips", () => {
    const { motion, onChange } = make("auto");

    media.fire(true);
    media.fire(true);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(true);

    motion.setSetting("always");
    expect(onChange).toHaveBeenCalledTimes(1);

    motion.setSetting("never");
    expect(onChange).toHaveBeenLastCalledWith(false);
    expect(motion.reduced).toBe(false);
  });

  it("ignores system changes while the setting is fixed", () => {
    const { onChange } = make("always");
    media.fire(true);
    media.fire(false);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("remembers the system answer for a later switch to auto", () => {
    const { motion, onChange } = make("never");
    media.fire(true);
    motion.setSetting("auto");
    expect(motion.reduced).toBe(true);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it.each([false, true])(
    "stops listening on dispose (legacy API: %s)",
    (legacy) => {
      const { motion, onChange } = make("auto", false, legacy);
      expect(media.listenerCount()).toBe(1);
      motion.dispose();
      expect(media.listenerCount()).toBe(0);
      media.fire(true);
      expect(onChange).not.toHaveBeenCalled();
    },
  );
});
