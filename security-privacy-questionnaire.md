# CPU Performance API: Security and Privacy Questionnaire Answers

The following are the answers to the W3C TAG's [security and privacy self-review
questionnaire](https://w3ctag.github.io/security-questionnaire/).

**01. What information does this feature expose, and for what purposes?**

This API exposes some information about how powerful the user device is. In
particular, it classifies user devices according to their CPU performance in a
small number of performance tiers, each represented by a small integer number.
This allows web applications to provide an improved user experience, e.g., by
adapting web content, controlling non-essential tasks and requests, improving
real user monitoring, deciding to run computations on the client side vs. on the
server side, etc.

**02. Do features in your specification expose the minimum amount of information necessary to implement the intended functionality?**

Yes. By classifying CPU performance in a small number of performance tiers, a
minimum amount of low-entropy information is exposed. The specification requires
each tier to represent a significant portion of the device population to prevent
fingerprinting.

**03. Do the features in your specification expose personal information, personally-identifiable information (PII), or information derived from either?**

No. The information exposed by this API is not personal information or
personally-identifiable information.

**04. How do the features in your specification deal with sensitive information?**

This API does not deal with sensitive information.

**05. Does data exposed by your specification carry related but distinct information that may not be obvious to users?**

No. What is exposed is very simple and should be obvious to users.

**06. Do the features in your specification introduce state that persists across browsing sessions?**

No. This API does not introduce any new persistent state.

**07. Do the features in your specification expose information about the underlying platform to origins?**

Yes. This API exposes some very limited information about how powerful the
underlying platform is (see answer to question 1).

**08. Does this specification allow an origin to send data to the underlying platform?**

No.

**09. Do features in this specification enable access to device sensors?**

No. This API does not allow direct access to sensors.

**10. Do features in this specification enable new script execution/loading mechanisms?**

No.

**11. Do features in this specification allow an origin to access other devices?**

No.

**12. Do features in this specification allow an origin some measure of control over a user agent's native UI?**

No.

**13. What temporary identifiers do the features in this specification create or expose to the web?**

None. The API exposes a hardware-based performance tier, which is not a
temporary identifier.

**14. How does this specification distinguish between behavior in first-party and third-party contexts?**

The API behaves identically in first-party and third-party contexts. It is
available to all secure contexts to allow both first-party applications and
third-party content (such as embedded video players) to adapt to the device's
performance tier.

**15. How do the features in this specification work in the context of a browser’s Private Browsing or Incognito mode?**

The API behaves identically in Private Browsing or Incognito mode. This is
essential for ensuring that users have a consistent experience, regardless of
their browsing mode.

**16. Does this specification have both "Security Considerations" and "Privacy Considerations" sections?**

Yes.

**17. Do features in your specification enable origins to downgrade default security protections?**

No.

**18. What happens when a document that uses your feature is kept alive in BFCache (instead of getting destroyed) after navigation, and potentially gets reused on future navigations back to the document?**

This API exposes static information which does not change while a document is in
BFCache. Restoring the document from BFCache will result in the same performance
tier value being returned.

**19. What happens when a document that uses your feature gets disconnected?**

This API exposes static information which does not depend on the document's
connection to a browsing context. The API will return the same performance tier
value if the document is disconnected.

**20. Does your spec define when and how new kinds of errors should be raised?**

There are no new errors or error conditions introduced by this feature.

**21. Does your feature allow sites to learn about the user's use of assistive technology?**

No.

**22. What should this questionnaire have asked?**

We think that the questions in this questionnaire accurately capture the API's
security and privacy implications.
