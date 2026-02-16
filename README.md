# CPU Performance API

This proposal is an early design sketch by Chrome to describe the problem below and solicit
feedback on the proposed solution. It has not been approved to ship in Chrome.

## Authors:

- Nikolaos Papaspyrou (Google Chrome)

## Participate
- [Issue tracker](https://github.com/WICG/cpu-performance/issues)
- [Discussion forum](https://github.com/WICG/cpu-performance/discussions)

## Table of Contents

<!-- Update this table of contents by running `npx doctoc README.md` -->
<!-- START doctoc generated TOC please keep comment here to allow auto update -->
<!-- DON'T EDIT THIS SECTION, INSTEAD RE-RUN doctoc TO UPDATE -->

- [Introduction](#introduction)
- [Motivating Use Cases](#motivating-use-cases)
  - [Goals](#goals)
  - [Non-goals](#non-goals)
- [Proposed Approach](#proposed-approach)
- [Alternatives Considered](#alternatives-considered)
  - [Nature and Semantics of Performance Buckets](#nature-and-semantics-of-performance-buckets)
  - [Benchmark-based Classification](#benchmark-based-classification)
- [Accessibility, Privacy, and Security Considerations](#accessibility-privacy-and-security-considerations)
- [Stakeholder Feedback / Opposition](#stakeholder-feedback--opposition)
- [References & Acknowledgements](#references--acknowledgements)

<!-- END doctoc generated TOC please keep comment here to allow auto update -->

## Introduction

We propose a new Web API that exposes some information about how powerful the
user device is. This API targets applications that will use this information to
provide an improved user experience, possibly in combination with the [Compute
Pressure API](https://github.com/w3c/compute-pressure), which provides
information about the user device’s CPU pressure/utilization and allows
applications to react to changes in CPU pressure. E.g., video-conferencing
applications or video games may use this information to decide if advanced video
effects can be rendered; all types of applications may use it to decide whether
to attempt running AI tasks locally or delegate to the server, etc.

The main consideration for implementing such an API is related to user privacy.
Exposing detailed CPU information (such as the CPU vendor, model name, the
number of processors and cores, etc., that the internal API currently provides)
is not an option, as it violates user privacy by allowing fingerprinting.

## Motivating Use Cases

At present, some platforms make it possible for apps such as video conferencing
applications to classify devices into performance categories via advanced
non-web-exposed functionality. Our proposal allows these applications to support
existing functionality that's enabled by device performance classification,
without depending on such non-standard features.

Applications whose functionality depends on client-side hardware detection often
resort to running benchmark workloads, to estimate hardware capabilities.
Providing a public CPU Performance API would help prevent a needless waste of
resources.

### Goals

-   Allow applications to estimate CPU performance without resorting to
    internal/private extensions or APIs and without resorting to running
    custom benchmark workloads.
-   Protect user privacy. The proposed API must not expose more device
    information than what can be easily obtained by other means (e.g.,
    benchmarking) and, even then, it must not facilitate user fingerprinting.

In order to fulfill these two goals, the proposed API can use some sort of
classification for the user device's hardware, mapping specific devices to a
small number of **performance buckets**. With this type of solution in mind,
further goals of the proposed API are:

-   Be hardware agnostic. The API's specification should not contain an explicit
    database-like mapping of existing hardware to performance buckets.
-   Be consistent and reproducible. The mapping of devices to performance
    buckets should reflect the performance that can be measured with specific
    benchmarks, ideally using programming tools provided by a browser
    (JavaScript, WebAssembly, etc.).
-   Be future-proof. The proposed API should be easily and predictably
    extensible for hardware that will be released in the future. In particular,
    if the API’s implementation is based on some database, the API should
    function properly even for existing hardware that is not contained in the
    database.
-   Respect privacy. Each performance bucket should contain a fairly large
    number of devices that exist on the internet at any given time, both as an
    absolute number and as distinct device models.
-   Respect obsolete hardware and applications. The same version of a web
    application should produce the same user experience on the same hardware, at
    any time in the future. Therefore, the performance bucket associated with a
    specific user device should not change over time.

### Non-goals

This version of the API focuses on CPU performance. It does not target other
hardware characteristics that are possibly useful, such as GPU performance,
available memory, power consumption, and so on.

## Proposed Approach

Similarly to the web-exposed [Device Memory
API](https://github.com/w3c/device-memory), the proposed API will add a new
read-only attribute to navigator: `navigator.cpuPerformance`, which returns
a small integer number, indicating the performance bucket that corresponds
to the user device. The exact value of this attribute (an `unsigned short`)
will be implementation specific and it will be generally expected to reflect
the **performance tier** in which a user device belongs. Higher values
correspond to higher performance tiers.

There will be four distinct performance tiers, numbered 1-4, and the
special value 0 will correspond to an unknown performance tier (returned in
case the API's implementation is unable to classify the user device).
Applications using the API should handle additional tiers which are likely to
be added in future as devices improve over time. Implementations should not
redefine tiers; that is, tier 4 devices should not be reclassified as tier 3
to accommodate newer, higher-powered devices as technology improves. Instead,
a new tier 5 will be added for those newer devices when the need arises, and
then a tier 6 and so on.

For example, a video conferencing application could interpret the four
performance tiers as follows. Bear in mind that this interpretation is
application specific and, even then, it may have to be updated in the
future if the application itself is updated and its hardware requirements
change.

-   1: devices that are practically unusable for video calls;
-   2: underpowered devices but still adequately suited for video calls;
-   3: devices that can comfortably accommodate video calls; and
-   4: devices that can run even the most demanding scenarios and have
    performance to spare for multitasking.

Such an application could use the value of `navigator.cpuPerformance`
for pre-selecting a number of features that are best supported by the
user device's performance tier.

```js
function getPresetFeatures() {
  switch (navigator.cpuPerformance) {
    case 1:
      return {
        videoQuality: "QVGA",
        frameRate: 15,
        effects: [],
      };
    case 2:
      return {
        videoQuality: "VGA",
        frameRate: 15,
        effects: ['voice-detection', 'animated-reactions'],
      };
    case 3:
      return {
        videoQuality: "720p",
        frameRate: 30,
        effects: ['voice-detection', 'animated-reactions',
                  'noise-reduction'],
      };
    case 4:
    case 0:    // Assuming high performance settings for unknown devices
    default:   // and for performance tiers higher than 4.
      return {
        videoQuality: "1080p",
        frameRate: 30,
        effects: ['voice-detection', 'animated-reactions',
                  'noise-reduction', 'virtual-background'],
      };
  }
}
```

The API's specification should determine the smallest and largest acceptable
bucket size, to prevent fingerprinting. This size should be in the order of a
few hundred different CPU models.

## Alternatives Considered

### Nature and Semantics of Performance Buckets

As prescribed by this document, performance buckets are "stable", in the sense
that the mapping of a user device to one bucket does not change with time. Using
an alternative approach, buckets could be "moving" and some particular hardware
that is mapped to one bucket today would be allowed to be mapped to one other
(most probably inferior) bucket in the future. With moving buckets, the total
number of buckets could be kept constant. In contrast, new stable performance
buckets need to be created when new hardware emerges that is significantly more
powerful than the existing one. It is not clear, however, when exactly a such
new bucket should be introduced, as new buckets should be large enough to
prevent fingerprinting. Moreover, fingerprinting can be an issue for "too old"
hardware as well, because the number of actual devices on the internet that are
mapped to the lower buckets will certainly diminish with the passing of time.

Using stable buckets has been preferred, as it respects obsolete hardware and
applications: The same version of a web application produces the same user
experience on the same hardware, at any time in the future.

### Benchmark-based Classification

The use of specific benchmark, included in the proposed API's specification, for
classifying user devices in a small number of performance buckets has been
considered as an alternative to leaving the details of this classification as
implementation specific. Ideally, such a benchmark should be as simple as
possible, defined in JavaScript and/or WebAssembly and publicly available. Its
result should be a numerical score and the API's specification should define how
this score is mapped to the performance buckets.

In case a benchmark is executed dynamically in the browser to classify the user
device, we should keep in mind that we have no control over the device, and
therefore we cannot guarantee an ideal and reproducible benchmarking
environment. Because of changing workloads in the user device, it is possible
that the classification will be different at different moments in time and this
may result in a different user experience for a web application. For this
reason, not using a benchmark is the API's specification has been preferred.
Browsers are free to implement the mapping of user devices to performance
buckets in any way that they see fit, using static hardware characteristics or
executing benchmarks dynamically.

## Accessibility, Privacy, and Security Considerations

This API raises several issues about user privacy and fingerprinting, discussed
in more detail in the main body of the document. The issues are mitigated mainly
by mapping user devices to a small number of performance buckets, each
containing a fairly large number of devices that exist on the internet at any
given time, both as an absolute number and as distinct device models.

Research results show that detecting architecture using microbenchmarks in a
browser is feasible to a large extent, both for CPU (see [1]) and for GPU (see
[2] and [3]), so there is probably no point in trying too hard to protect it.

The API will only be available on HTTPS secure connections.

## Stakeholder Feedback / Opposition

- Chrome: Positive
- Edge: No public signal
- Firefox: No public signal
- Safari: No public signal

## References & Acknowledgements

Many thanks for valuable feedback and advice from:

- Dominic Farolino
- Deepti Gandluri
- Reilly Grant
- Tomas Gunnarsson
- Markus Handell
- Michael Lippautz
- Thomas Nattestad
- Nicola Tommasi
- Guido Urdaneta
- Måns Vestin
- Chen Xing

This explainer is based on
[the W3C TAG's template](https://github.com/w3ctag/explainer-explainer).

[1]: https://misc0110.net/files/uarchfp_esorics22.pdf
[2]: https://ieeexplore.ieee.org/document/5214359
[3]: https://ieeexplore.ieee.org/document/5452013
