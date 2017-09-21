import * as React from "react";

interface ContainerProps {

}

export class Container extends React.Component<ContainerProps, {}> {
  render() {
    return (
      <div>{this.props.children}</div>
    );
  }
}
