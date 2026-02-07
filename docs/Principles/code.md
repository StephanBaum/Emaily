"Clean Code" is a philosophy primarily popularized by Robert C. Martin ("Uncle Bob"). It focuses on writing code that is easy to read, simple to maintain, and clear enough for any developer to understand at first glance.

Below is a complete categorization of the core principles and best practices of Clean Code.

---

## 1. Core Meta-Principles

These are the overarching philosophies that govern all other rules.

* **The Boy Scout Rule:** Always leave the code a little cleaner than you found it.
* **KISS (Keep It Simple, Stupid):** Simplicity should be a key goal. Avoid unnecessary complexity.
* **DRY (Don’t Repeat Yourself):** Every piece of knowledge must have a single, unambiguous representation within a system.
* **YAGNI (You Ain't Gonna Need It):** Do not implement features or complexity based on "what might be needed" in the future.
* **Principle of Least Surprise (POLS):** Code should do exactly what a reader expects it to do based on its name and context.

---

## 2. Meaningful Naming

Naming is perhaps the most important skill in Clean Code.

* **Use Intention-Revealing Names:** A variable's name should tell you why it exists, what it does, and how it is used (e.g., `daysSinceLastUpdate` instead of `d`).
* **Avoid Disinformation:** Don't refer to a group of accounts as `accountList` unless it is actually a `List`. Use `accounts` instead.
* **Make Meaningful Distinctions:** Avoid "noise words" like `ProductData` vs. `ProductInfo`. If they aren't different, don't use different names.
* **Use Pronounceable & Searchable Names:** Avoid abbreviations like `genymdhms`. Use `generationTimestamp`.
* **Class Names:** Should be **nouns** or noun phrases (e.g., `Customer`, `WikiPage`). Avoid `Manager`, `Processor`, `Data`.
* **Method Names:** Should be **verbs** or verb phrases (e.g., `postPayment`, `deletePage`).

---

## 3. Function Best Practices

Functions are the basic building blocks of any program.

* **Small!:** The first rule of functions is that they should be small. The second rule is that they should be even smaller.
* **Do One Thing (SRP):** A function should have one responsibility and do it well.
* **One Level of Abstraction:** Don't mix high-level business logic with low-level details (like string manipulation) in the same function.
* **Function Arguments:** * **Ideal:** 0 (niladic)
* **Good:** 1 (monadic)
* **Acceptable:** 2 (dyadic)
* **Avoid:** 3+ (triadic). If you need more, wrap them in an object.


* **No Flag Arguments:** Don't pass Booleans into functions to change their behavior. Split the function into two instead.
* **No Side Effects:** A function shouldn't secretly change a global variable or modify state unless that is its explicit purpose.

---

## 4. The SOLID Principles

These five principles are the foundation of clean Object-Oriented Design.

| Principle | Description |
| --- | --- |
| **S**ingle Responsibility | A class should have one, and only one, reason to change. |
| **O**pen/Closed | Software entities should be open for extension but closed for modification. |
| **L**iskov Substitution | Objects of a superclass should be replaceable with objects of its subclasses without breaking the application. |
| **I**nterface Segregation | Clients should not be forced to depend upon interfaces they do not use. |
| **D**ependency Inversion | Depend on abstractions (interfaces), not on concretions (classes). |

---

## 5. Commenting & Formatting

The best comment is the one you didn't have to write because the code was clear.

* **Comments do not make up for bad code:** If you have to explain it, refactor it.
* **Good Comments:** Legal comments, informative (regex explanation), warnings of consequences, TODOs.
* **Bad Comments:** Mumbling, redundant (commenting the obvious), noise, mandated (Javadocs for every single private variable), commented-out code (just delete it; use Git).
* **Vertical Formatting:** Concepts that are closely related should be kept vertically close to each other.
* **Horizontal Formatting:** Keep lines short (usually under 120 characters). Use whitespace to associate or disassociate things.

---

## 6. Error Handling

* **Use Exceptions, Not Return Codes:** Return codes clutter the caller with `if` statements.
* **Write Your Try-Catch-Finally First:** This defines the "scope" of your logic.
* **Don't Return Null:** Returning null leads to NullPointerExceptions. Return an empty collection or a "Special Case" object instead.
* **Don't Pass Null:** Avoid passing null into methods as it requires defensive checks everywhere.

---

## 7. Clean Testing (T.I.R.S.E / F.I.R.S.T)

Tests are just as important as production code and should be kept clean.

* **Fast:** Tests must be quick so you run them often.
* **Independent:** Tests should not depend on each other.
* **Repeatable:** They should work in any environment (Dev, CI, Prod).
* **Self-Validating:** They should have a boolean output (Pass/Fail).
* **Timely:** Write them just before or during the production code (TDD).

---