---
"@openapi-generator-plus/core": patch
---

Only conform an absorbing `anyOf` object to its members' interfaces when it can satisfy them.

Absorbing a member under the object strategy makes its properties optional, as only one member
need match, but the object still claimed to implement the interfaces derived from those members,
which declare the same properties as required. Where a generator makes `required` part of a
property's type it could not satisfy both, and the generated code did not compile:

```
javac:  getWidth() in Shape cannot implement getWidth() in IRectangle
        return type java.lang.Integer is not compatible with int
swiftc: type 'Shape' does not conform to protocol 'RectangleProtocol'
        note: protocol requires property 'width' with type 'Int'
```

The generator is now asked, through `checkPropertyCompatibility`, whether the object's optional
property satisfies the member's, and conformance is dropped when it does not. Generators that
don't express `required` in the type keep it, as do members that require nothing. The object still
absorbs every member's properties either way, so it remains a valid union of them.
