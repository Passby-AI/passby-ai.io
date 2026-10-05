---
title: C++中的const关键字
tags:
  - cpp
  - const
  - reference
  - lvalue
  - rvalue
  - const-correctness
categories:
  - C++
  - 编程基础
aliases: []
created: 2026-03
draft: false
slug: c-plus-plus中的const关键字
status: archived
---
### 1. 为什么 `const Point3&` 可以接受临时变量？

这与 C++ 中 "左值 (lvalue)" 和 "右值 (rvalue)" 的概念有关。

* **左值 (lvalue)**：可以简单理解为**有固定内存地址、有名字的变量**。你可以对它取地址。例如：`Point3 my_point;`，这里的 `my_point` 就是一个左值。

* **右值 (rvalue)**：通常指**临时的、没有名字的表达式结果**。例如 `Point3(0, 0, 0)` 或者函数返回值 `GetPoint()`。它们在表达式结束后就会被销毁。

* C++ 的引用绑定规则如下：

* **非 `const` 左值引用 (`Point3&`)**：**只能**绑定到一个左值上。

  * 编译器的逻辑是：如果用一个 `Point3&` 来接收参数，意味着你**可能想在函数内部修改它**。修改一个马上就要被销毁的临时变量（右值）是没有意义的，而且通常是编程错误，所以 C++ 语言禁止了这种行为。

* **`const` 左值引用 (`const Point3&`)**：**既可以**绑定到左值，**也可以**绑定到右值。

  * 编译器的逻辑是：因为加了 `const`，就等于向编译器做出了一个**承诺**：“我不会修改这个参数”。既然只是读取数据而不修改，那么绑定到一个临时的、即将销-毁的右值上也是完全安全和合理的。

* **举个例子：**

```c++
// 假设有这样一个函数
void process_point_non_const(Point3& p) { /* ... */ }
void process_point_const(const Point3& p) { /* ... */ }

int main() {
    Point3 vertex_a(1, 0, 0);

    // --- 使用非 const 引用 ---
    process_point_non_const(vertex_a);          // 正确：vertex_a 是一个左值
    // process_point_non_const(Point3(0, 1, 0)); // 错误！不能将右值（临时变量）绑定到非 const 引用

    // --- 使用 const 引用 ---
    process_point_const(vertex_a);              // 正确：可以绑定到左值
    process_point_const(Point3(0, 1, 0));       // 正确：也可以绑定到右值（临时变量）
}
```

因此，使用 `const Point3&` 能让函数（比如 某个类的构造函数）更具通用性。

### 2. `const` 如何保证数据不被修改？

`const` 就像一个**契约（Contract）**。当把参数声明为 `const Point3&` 时，你就和调用者签订了一个契约，内容是：“**在我的函数内部，我保证不会对你传入的这个 `Point3` 对象做任何修改。**”

编译器就是这个契约的监督者和执行者。如果你在函数内部违反了这个契约，编译器就会立刻发现并报告错误，阻止你的代码通过编译。

* **举个例子：**

```c++
class Point3 {
public:
    double x, y, z;
    void move(double dx, double dy, double dz) { // 这是一个会修改内部数据的函数
        x += dx;
        y += dy;
        z += dz;
    }
};

void my_function(const Point3& p) {
    // 尝试修改 p 的成员变量
    // p.x = 5.0; // 编译错误！因为 p 是 const，不能修改它的成员

    // 尝试调用 p 的非 const 成员函数
    // p.move(1, 1, 1); // 编译错误！因为 move() 不是一个 const 函数，它可能会修改对象
    
    // 读取数据是完全允许的
    double current_x = p.x; // 正确
}
```

这种机制被称为 **`const` 正确性 (const-correctness)**，是 C++ 编程中非常重要的一个概念。它有以下好处：

* **安全性**：从根本上防止了函数对传入的数据产生意料之外的副作用（比如意外修改）。

* **代码可读性**：当别人阅读你的函数签名 `void my_function(const Point3& p)` 时，能立刻明白这个函数不会修改参数 `p`，降低了理解代码的难度。

* **更好的设计**：它促使你思考哪些函数应该修改对象的状态，哪些不应该，从而设计出更清晰的类接口。

### 总结

总而言之，为构造函数或任何只读参数使用 `const Point3&` 是一个万全之策，因为它同时带来了两大好处：

1. **灵活性**：既能接受普通变量，也能接受临时表达式。

2. **安全性**：由编译器提供保障，确保传入的数据在你函数内部是只读的，杜绝了意外修改的风险。
